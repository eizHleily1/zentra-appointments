import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module";
import { AuthModule } from "../auth/auth.module";
import { BookingVerificationModule } from "../booking-verification/booking-verification.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { ServicesModule } from "../services/services.module";
import { StaffModule } from "../staff/staff.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";
import {
  BookingRateLimitGuard,
  BookingVerificationCheckRateLimitGuard,
  BookingVerificationRequestRateLimitGuard
} from "./booking-rate-limit.guard";

@Module({
  controllers: [DiscoveryController],
  imports: [
    AppointmentsModule,
    AuthModule,
    BookingVerificationModule,
    BusinessesModule,
    ServicesModule,
    StaffModule
  ],
  providers: [
    BookingRateLimitGuard,
    BookingVerificationCheckRateLimitGuard,
    BookingVerificationRequestRateLimitGuard,
    DiscoveryService
  ]
})
export class DiscoveryModule {}
