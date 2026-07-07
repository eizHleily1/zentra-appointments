import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { DatabaseModule } from "../database/database.module";
import { ClientsModule } from "../clients/clients.module";
import { ServicesModule } from "../services/services.module";
import { StaffModule } from "../staff/staff.module";
import { APPOINTMENT_REPOSITORY } from "./appointment.repository";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { PostgresAppointmentRepository } from "./postgres-appointment.repository";
import { SchedulingController } from "./scheduling.controller";

@Module({
  controllers: [AppointmentsController, SchedulingController],
  exports: [AppointmentsService],
  imports: [AuthModule, BusinessesModule, ClientsModule, DatabaseModule, ServicesModule, StaffModule],
  providers: [
    AppointmentsService,
    PostgresAppointmentRepository,
    {
      provide: APPOINTMENT_REPOSITORY,
      useExisting: PostgresAppointmentRepository
    }
  ]
})
export class AppointmentsModule {}
