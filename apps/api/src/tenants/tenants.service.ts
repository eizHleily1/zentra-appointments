import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { BusinessType } from "./business-type";
import { TENANT_REPOSITORY, type Tenant, type TenantRepository } from "./tenant.repository";

interface CreateTenantCommand {
  businessType: BusinessType;
  name: string;
  ownerUserId: string;
  timezone: string;
}

interface UpdateTenantCommand {
  businessType?: BusinessType;
  name?: string;
  requesterUserId: string;
  tenantId: string;
  timezone?: string;
}

@Injectable()
export class TenantsService {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository) {}

  async createTenant(command: CreateTenantCommand): Promise<Tenant> {
    const name = normalizeRequiredText(command.name, "Tenant name is required");
    const timezone = normalizeRequiredText(command.timezone, "Tenant timezone is required");

    return this.tenantRepository.createTenant({
      businessType: command.businessType,
      id: randomUUID(),
      initialOwnerUserId: command.ownerUserId,
      name,
      status: "PENDING_ONBOARDING",
      timezone
    });
  }

  async updateTenant(command: UpdateTenantCommand): Promise<Tenant> {
    const tenant = await this.getTenantForBootstrapOwner(command.tenantId, command.requesterUserId);
    const update = {
      businessType: command.businessType,
      name: command.name === undefined ? undefined : normalizeRequiredText(command.name, "Tenant name is required"),
      timezone:
        command.timezone === undefined ? undefined : normalizeRequiredText(command.timezone, "Tenant timezone is required")
    };

    const updatedTenant = await this.tenantRepository.updateTenant(tenant.id, update);

    if (!updatedTenant) {
      throw new NotFoundException("Tenant not found");
    }

    return updatedTenant;
  }

  async deactivateTenant(tenantId: string, requesterUserId: string): Promise<Tenant> {
    const tenant = await this.getTenantForBootstrapOwner(tenantId, requesterUserId);
    const deactivatedTenant = await this.tenantRepository.deactivateTenant(tenant.id);

    if (!deactivatedTenant) {
      throw new NotFoundException("Tenant not found");
    }

    return deactivatedTenant;
  }

  private async getTenantForBootstrapOwner(tenantId: string, requesterUserId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findTenantById(tenantId);

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    if (tenant.initialOwnerUserId !== requesterUserId) {
      throw new ForbiddenException("Tenant operation is restricted to the initial owner in Phase 3");
    }

    return tenant;
  }
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new BadRequestException(message);
  }

  return normalized;
}
