import type { BusinessType } from "./business-type";
import type { TenantStatus } from "./tenant-status";

export const TENANT_REPOSITORY = Symbol("TENANT_REPOSITORY");

export interface Tenant {
  businessType: BusinessType;
  createdAt: Date;
  id: string;
  initialOwnerUserId: string;
  name: string;
  status: TenantStatus;
  timezone: string;
  updatedAt: Date;
}

export interface CreateTenantInput {
  businessType: BusinessType;
  id: string;
  initialOwnerUserId: string;
  name: string;
  status: TenantStatus;
  timezone: string;
}

export interface UpdateTenantInput {
  businessType?: BusinessType;
  name?: string;
  timezone?: string;
}

export interface TenantRepository {
  createTenant(input: CreateTenantInput): Promise<Tenant>;
  deactivateTenant(id: string): Promise<Tenant | null>;
  findTenantById(id: string): Promise<Tenant | null>;
  updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant | null>;
}
