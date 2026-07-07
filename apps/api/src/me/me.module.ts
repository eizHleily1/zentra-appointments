import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module";
import { AuthModule } from "../auth/auth.module";
import { MeController } from "./me.controller";

@Module({
  controllers: [MeController],
  imports: [AppointmentsModule, AuthModule]
})
export class MeModule {}
