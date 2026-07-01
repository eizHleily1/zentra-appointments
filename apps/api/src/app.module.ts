import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { HealthController } from "./health/health.controller";
import { ServicesModule } from "./services/services.module";
import { TenantsModule } from "./tenants/tenants.module";
import { validateEnvironment } from "./config/environment";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment
    }),
    AuthModule,
    BusinessesModule,
    ServicesModule,
    TenantsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
