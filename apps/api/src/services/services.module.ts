import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { DatabaseModule } from "../database/database.module";
import { PostgresServiceRepository } from "./postgres-service.repository";
import { SERVICE_REPOSITORY } from "./service.repository";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";

@Module({
  controllers: [ServicesController],
  imports: [AuthModule, BusinessesModule, DatabaseModule],
  providers: [
    PostgresServiceRepository,
    ServicesService,
    {
      provide: SERVICE_REPOSITORY,
      useExisting: PostgresServiceRepository
    }
  ]
})
export class ServicesModule {}
