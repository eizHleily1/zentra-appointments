import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/environment";
import type { PhoneVerificationSender, SendVerificationCodeInput } from "./phone-verification.sender";

/**
 * Zero-cost sender for local development and manual testing. It never talks to an
 * SMS vendor. Outside production it prints the code so the flow can be exercised
 * by hand; in production it stays silent about the code so logs never leak an OTP.
 */
@Injectable()
export class LoggingPhoneVerificationSender implements PhoneVerificationSender {
  private readonly logger = new Logger(LoggingPhoneVerificationSender.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    if (this.configService.get("NODE_ENV", { infer: true }) === "production") {
      this.logger.warn(
        `No SMS provider is configured; a booking verification code for business ${input.businessId} was not delivered`
      );
      return;
    }

    this.logger.log(
      `Booking verification code for ${input.phoneNumber} at business ${input.businessId}: ${input.code}`
    );
  }
}
