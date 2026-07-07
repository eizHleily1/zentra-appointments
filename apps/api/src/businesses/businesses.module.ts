import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ServicesModule } from "../services/services.module";
import { StaffModule } from "../staff/staff.module";
import { BUSINESS_HOURS_REPOSITORY } from "./business-hours.repository";
import { BUSINESS_REPOSITORY } from "./business.repository";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";
import { PostgresBusinessHoursRepository } from "./postgres-business-hours.repository";
import { PostgresBusinessRepository } from "./postgres-business.repository";

@Module({
  controllers: [BusinessesController],
  imports: [AuthModule, DatabaseModule, forwardRef(() => ServicesModule), forwardRef(() => StaffModule)],
  providers: [
    BusinessesService,
    PostgresBusinessRepository,
    PostgresBusinessHoursRepository,
    {
      provide: BUSINESS_REPOSITORY,
      useExisting: PostgresBusinessRepository
    },
    {
      provide: BUSINESS_HOURS_REPOSITORY,
      useExisting: PostgresBusinessHoursRepository
    }
  ],
  exports: [BUSINESS_REPOSITORY, BUSINESS_HOURS_REPOSITORY]
})
export class BusinessesModule {}
