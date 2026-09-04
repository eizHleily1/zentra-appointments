import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { DatabaseModule } from "../database/database.module";
import { ClientsModule } from "../clients/clients.module";
import { ServicesModule } from "../services/services.module";
import { StaffModule } from "../staff/staff.module";
import { APPOINTMENT_REPOSITORY } from "./appointment.repository";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { GUEST_BOOKING_REPOSITORY } from "./guest-booking.repository";
import { PostgresAppointmentRepository } from "./postgres-appointment.repository";
import { PostgresGuestBookingRepository } from "./postgres-guest-booking.repository";
import { SchedulingController } from "./scheduling.controller";

@Module({
  controllers: [AppointmentsController, SchedulingController],
  exports: [APPOINTMENT_REPOSITORY, AppointmentsService],
  imports: [AuthModule, BusinessesModule, forwardRef(() => ClientsModule), DatabaseModule, ServicesModule, StaffModule],
  providers: [
    AppointmentsService,
    PostgresAppointmentRepository,
    PostgresGuestBookingRepository,
    {
      provide: APPOINTMENT_REPOSITORY,
      useExisting: PostgresAppointmentRepository
    },
    {
      provide: GUEST_BOOKING_REPOSITORY,
      useExisting: PostgresGuestBookingRepository
    }
  ]
})
export class AppointmentsModule {}
