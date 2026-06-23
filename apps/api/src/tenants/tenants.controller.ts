import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  createTenant(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTenantDto) {
    return this.tenantsService.createTenant({
      businessType: body.businessType,
      name: body.name,
      ownerUserId: user.id,
      timezone: body.timezone
    });
  }

  @Patch(":tenantId")
  updateTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateTenantDto
  ) {
    return this.tenantsService.updateTenant({
      businessType: body.businessType,
      name: body.name,
      requesterUserId: user.id,
      tenantId,
      timezone: body.timezone
    });
  }

  @Post(":tenantId/deactivate")
  deactivateTenant(@CurrentUser() user: AuthenticatedUser, @Param("tenantId") tenantId: string) {
    return this.tenantsService.deactivateTenant(tenantId, user.id);
  }
}
