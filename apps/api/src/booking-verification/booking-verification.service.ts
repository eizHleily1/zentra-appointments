import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomInt, randomUUID } from "node:crypto";
import { PasswordService } from "../auth/password.service";
import { BUSINESS_REPOSITORY, type BusinessRepository } from "../businesses/business.repository";
import { normalizePhoneNumber } from "../clients/client-phone";
import type { AppConfig } from "../config/environment";
import {
  BOOKING_VERIFICATION_REPOSITORY,
  BookingVerificationCooldownError,
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

    const attemptsRemaining = this.configService.get("GUEST_BOOKING_VERIFICATION_MAX_ATTEMPTS", { infer: true });
    const ttlSeconds = this.configService.get("GUEST_BOOKING_VERIFICATION_CODE_TTL_SECONDS", { infer: true });
    const cooldownSeconds = this.configService.get("GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS", {
      infer: true
    });
    const code = generateVerificationCode();
    let deliveryFailed = false;

    try {
      // The cooldown check, the insert, and the send all live in one transaction, so a
      // send failure leaves no row behind to claim success or to block the next request.
      const verification = await this.verificationRepository.issueVerification(
        {
          attemptsRemaining,
          businessId: input.businessId,
          codeHash: await this.passwordService.hash(code),
          cooldownSeconds,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
          id: randomUUID(),
          normalizedPhone
        },
        async () => {
          try {
            await this.verificationSender.sendVerificationCode({
              businessId: input.businessId,
              code,
              phoneNumber
            });
          } catch (error) {
            deliveryFailed = true;
            throw error;
          }
        }
      );

      return {
        attemptsRemaining: verification.attemptsRemaining,
        expiresAt: verification.expiresAt,
        verificationId: verification.id
      };
    } catch (error) {
      if (error instanceof BookingVerificationCooldownError) {
        throw new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
      }

      if (deliveryFailed) {
        throw new ServiceUnavailableException("Could not send a verification code. Try again.");
      }

      throw error;
    }
  }

  async verifyCode(input: {
    businessId: string;
    code: string;
    verificationId: string;
  }): Promise<BookingVerificationResult> {
    // Spend the attempt before looking at the code. Reading first would let concurrent
    // requests share one remaining attempt and guess past the configured maximum.
    const claimed = await this.verificationRepository.claimVerificationAttempt(
      input.businessId,
      input.verificationId
    );

    if (!claimed) {
      return this.resolveUnclaimableVerification(input.businessId, input.verificationId);
    }

    if (!(await this.passwordService.verify(input.code.trim(), claimed.codeHash))) {
      if (claimed.attemptsRemaining <= 0) {
        throw new BadRequestException("Too many incorrect codes. Request a new code.");
      }

      throw new BadRequestException("Verification code is invalid or expired");
    }

    const verified = await this.verificationRepository.markVerificationVerified(claimed.id);

    if (!verified) {
      throw new BadRequestException("Verification code is invalid or expired");
    }

    return toVerificationResult(verified);
  }

  /**
   * Explains why an attempt could not be claimed. A challenge that another request just
   * verified is still a success for this caller, so a correct code is never rejected
   * because it arrived twice.
   */
  private async resolveUnclaimableVerification(
    businessId: string,
    verificationId: string
  ): Promise<BookingVerificationResult> {
    const verification = await this.verificationRepository.findVerificationForBusiness(businessId, verificationId);

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
      return toVerificationResult(verification);
    }

    if (verification.attemptsRemaining <= 0) {
      throw new BadRequestException("Too many incorrect codes. Request a new code.");
    }

    throw new BadRequestException("Verification code is invalid or expired");
  }
}

function toVerificationResult(verification: {
  attemptsRemaining: number;
  expiresAt: Date;
  id: string;
}): BookingVerificationResult {
  return {
    attemptsRemaining: verification.attemptsRemaining,
    expiresAt: verification.expiresAt,
    verificationId: verification.id,
    verified: true
  };
}

function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
