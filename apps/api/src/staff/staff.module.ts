import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { DatabaseModule } from "../database/database.module";
import { PostgresStaffRepository } from "./postgres-staff.repository";
import { STAFF_REPOSITORY } from "./staff.repository";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";

@Module({
  controllers: [StaffController],
  imports: [AuthModule, forwardRef(() => BusinessesModule), DatabaseModule],
  providers: [
    PostgresStaffRepository,
    StaffService,
    {
      provide: STAFF_REPOSITORY,
      useExisting: PostgresStaffRepository
    }
  ],
  exports: [STAFF_REPOSITORY]
})
export class StaffModule {}
