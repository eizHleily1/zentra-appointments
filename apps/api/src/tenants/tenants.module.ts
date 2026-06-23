import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PostgresTenantRepository } from "./postgres-tenant.repository";
import { TENANT_REPOSITORY } from "./tenant.repository";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  controllers: [TenantsController],
  imports: [AuthModule, DatabaseModule],
  providers: [
    PostgresTenantRepository,
    TenantsService,
    {
      provide: TENANT_REPOSITORY,
      useExisting: PostgresTenantRepository
    }
  ]
})
export class TenantsModule {}
