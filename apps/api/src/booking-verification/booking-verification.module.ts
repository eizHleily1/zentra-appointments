import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { DatabaseModule } from "../database/database.module";
import { BOOKING_VERIFICATION_REPOSITORY } from "./booking-verification.repository";
import { BookingVerificationService } from "./booking-verification.service";
import { LoggingPhoneVerificationSender } from "./logging-phone-verification.sender";
import { PHONE_VERIFICATION_SENDER } from "./phone-verification.sender";
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
      provide: PHONE_VERIFICATION_SENDER,
      useExisting: LoggingPhoneVerificationSender
    }
  ]
})
export class BookingVerificationModule {}
