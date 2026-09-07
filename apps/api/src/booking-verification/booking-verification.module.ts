import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import type { AppConfig } from "../config/environment";
import { DatabaseModule } from "../database/database.module";
import { BOOKING_VERIFICATION_REPOSITORY } from "./booking-verification.repository";
import { BookingVerificationService } from "./booking-verification.service";
import { LoggingPhoneVerificationSender } from "./logging-phone-verification.sender";
import { PHONE_VERIFICATION_SENDER, type PhoneVerificationSender } from "./phone-verification.sender";
import { PostgresBookingVerificationRepository } from "./postgres-booking-verification.repository";

@Module({
  exports: [BOOKING_VERIFICATION_REPOSITORY, BookingVerificationService],
  imports: [AuthModule, BusinessesModule, DatabaseModule],
  providers: [
    BookingVerificationService,
    LoggingPhoneVerificationSender,
    PostgresBookingVerificationRepository,
    {
      provide: BOOKING_VERIFICATION_REPOSITORY,
      useExisting: PostgresBookingVerificationRepository
    },
    {
      // Adding a real vendor means adding its value to PHONE_VERIFICATION_PROVIDERS and a
      // branch here. `validateEnvironment` already refuses to boot production on "log".
      inject: [ConfigService, LoggingPhoneVerificationSender],
      provide: PHONE_VERIFICATION_SENDER,
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        loggingSender: LoggingPhoneVerificationSender
      ): PhoneVerificationSender => {
        const provider = configService.get("PHONE_VERIFICATION_PROVIDER", { infer: true });

        if (provider === "log") {
          return loggingSender;
        }

        throw new Error(`No phone verification sender is implemented for PHONE_VERIFICATION_PROVIDER=${provider}`);
      }
    }
  ]
})
export class BookingVerificationModule {}
