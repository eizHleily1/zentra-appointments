import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppointmentsModule } from "./appointments/appointments.module";
import { AuthModule } from "./auth/auth.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { HealthController } from "./health/health.controller";
import { ClientsModule } from "./clients/clients.module";
import { MeModule } from "./me/me.module";
import { ServicesModule } from "./services/services.module";
import { StaffModule } from "./staff/staff.module";
import { TenantsModule } from "./tenants/tenants.module";
import { validateEnvironment } from "./config/environment";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment
    }),
    AppointmentsModule,
    AuthModule,
    BusinessesModule,
    ClientsModule,
    DiscoveryModule,
    MeModule,
    ServicesModule,
    StaffModule,
    TenantsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
