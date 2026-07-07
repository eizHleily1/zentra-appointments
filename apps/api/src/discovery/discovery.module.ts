import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { ServicesModule } from "../services/services.module";
import { StaffModule } from "../staff/staff.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  controllers: [DiscoveryController],
  imports: [AppointmentsModule, AuthModule, BusinessesModule, ServicesModule, StaffModule],
  providers: [DiscoveryService]
})
export class DiscoveryModule {}
