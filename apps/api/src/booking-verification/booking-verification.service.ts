import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomInt, randomUUID } from "node:crypto";
import { PasswordService } from "../auth/password.service";
import { BUSINESS_REPOSITORY, type BusinessRepository } from "../businesses/business.repository";
import { normalizePhoneNumber } from "../clients/client-phone";
import type { AppConfig } from "../config/environment";
import {
  BOOKING_VERIFICATION_REPOSITORY,
  type BookingVerificationRepository
} from "./booking-verification.repository";
import { PHONE_VERIFICATION_SENDER, type PhoneVerificationSender } from "./phone-verification.sender";

export interface BookingVerificationChallenge {
  attemptsRemaining: number;
  expiresAt: Date;
  verificationId: string;
}

export interface BookingVerificationResult {
  attemptsRemaining: number;
  expiresAt: Date;
  verificationId: string;
  verified: true;
}

@Injectable()
export class BookingVerificationService {
  constructor(
    @Inject(BOOKING_VERIFICATION_REPOSITORY)
    private readonly verificationRepository: BookingVerificationRepository,
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(PHONE_VERIFICATION_SENDER) private readonly verificationSender: PhoneVerificationSender,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService<AppConfig, true>
  ) {}

  async requestVerification(input: {
    businessId: string;
    phoneNumber: string;
  }): Promise<BookingVerificationChallenge> {
    const business = await this.businessRepository.findActiveBusinessById(input.businessId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    const phoneNumber = input.phoneNumber.trim();
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      throw new BadRequestException("Enter a valid phone number");
    }

    await this.assertResendCooldownElapsed(input.businessId, normalizedPhone);

    const attemptsRemaining = this.configService.get("GUEST_BOOKING_VERIFICATION_MAX_ATTEMPTS", { infer: true });
    const ttlSeconds = this.configService.get("GUEST_BOOKING_VERIFICATION_CODE_TTL_SECONDS", { infer: true });
    const code = generateVerificationCode();
    const verification = await this.verificationRepository.createVerification({
      attemptsRemaining,
      businessId: input.businessId,
      codeHash: await this.passwordService.hash(code),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      id: randomUUID(),
      normalizedPhone
    });

    await this.verificationSender.sendVerificationCode({
      businessId: input.businessId,
      code,
      phoneNumber
    });

    return {
      attemptsRemaining: verification.attemptsRemaining,
      expiresAt: verification.expiresAt,
      verificationId: verification.id
    };
  }

  async verifyCode(input: {
    businessId: string;
    code: string;
    verificationId: string;
  }): Promise<BookingVerificationResult> {
    const verification = await this.verificationRepository.findVerificationForBusiness(
      input.businessId,
      input.verificationId
    );

    // A missing challenge and a challenge belonging to another business are reported
    // identically so the endpoint never confirms that an identity exists.
    if (!verification) {
      throw new BadRequestException("Verification code is invalid or expired");
    }

    if (verification.consumedAt) {
      throw new BadRequestException("This verification has already been used");
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Verification code expired");
    }

    if (verification.verifiedAt) {
      return {
        attemptsRemaining: verification.attemptsRemaining,
        expiresAt: verification.expiresAt,
        verificationId: verification.id,
        verified: true
      };
    }

    if (verification.attemptsRemaining <= 0) {
      throw new BadRequestException("Too many incorrect codes. Request a new code.");
    }

    if (!(await this.passwordService.verify(input.code.trim(), verification.codeHash))) {
      const updated = await this.verificationRepository.recordFailedAttempt(verification.id);

      if (updated && updated.attemptsRemaining <= 0) {
        throw new BadRequestException("Too many incorrect codes. Request a new code.");
      }

      throw new BadRequestException("Verification code is invalid or expired");
    }

    const verified = await this.verificationRepository.markVerificationVerified(verification.id);

    if (!verified) {
      throw new BadRequestException("Verification code is invalid or expired");
    }

    return {
      attemptsRemaining: verified.attemptsRemaining,
      expiresAt: verified.expiresAt,
      verificationId: verified.id,
      verified: true
    };
  }

  private async assertResendCooldownElapsed(businessId: string, normalizedPhone: string): Promise<void> {
    const cooldownSeconds = this.configService.get("GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS", {
      infer: true
    });

    if (cooldownSeconds <= 0) {
      return;
    }

    const latest = await this.verificationRepository.findLatestVerificationForPhone(businessId, normalizedPhone);

    if (!latest) {
      return;
    }

    if (Date.now() - latest.createdAt.getTime() < cooldownSeconds * 1000) {
      throw new HttpException("Wait before requesting another verification code", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
