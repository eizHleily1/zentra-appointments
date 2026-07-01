import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { BUSINESS_REPOSITORY } from "./business.repository";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";
import { PostgresBusinessRepository } from "./postgres-business.repository";

@Module({
  controllers: [BusinessesController],
  imports: [AuthModule, DatabaseModule],
  providers: [
    BusinessesService,
    PostgresBusinessRepository,
    {
      provide: BUSINESS_REPOSITORY,
      useExisting: PostgresBusinessRepository
    }
  ]
})
export class BusinessesModule {}
