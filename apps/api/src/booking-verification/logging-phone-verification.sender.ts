import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/environment";
import type { PhoneVerificationSender, SendVerificationCodeInput } from "./phone-verification.sender";

/**
 * Zero-cost sender for local development and manual testing. It never talks to an SMS
 * vendor, so it is rejected at startup in production by `validateEnvironment`.
 *
 * Printing the code is gated on the explicit `PHONE_VERIFICATION_LOG_CODES` opt-in
 * rather than on "not production", so staging, preview, and CI hosts do not leak
 * usable codes into their logs just by having a non-production NODE_ENV.
 */
@Injectable()
export class LoggingPhoneVerificationSender implements PhoneVerificationSender {
  private readonly logger = new Logger(LoggingPhoneVerificationSender.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    if (this.configService.get("PHONE_VERIFICATION_LOG_CODES", { infer: true })) {
      this.logger.log(
        `Booking verification code for ${input.phoneNumber} at business ${input.businessId}: ${input.code}`
      );
      return;
    }

    this.logger.log(
      `Issued a booking verification code for ${maskPhoneNumber(input.phoneNumber)} at business ${input.businessId}. ` +
        "Set PHONE_VERIFICATION_LOG_CODES=true locally to print it."
    );
  }
}

function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  return digits.length <= 4 ? "****" : `****${digits.slice(-4)}`;
}
