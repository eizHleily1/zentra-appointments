import type {
  CreateTenantInput,
  Tenant,
  TenantRepository,
  UpdateTenantInput
} from "../src/tenants/tenant.repository";

export class InMemoryTenantRepository implements TenantRepository {
  private readonly tenants = new Map<string, Tenant>();

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const now = new Date();
    const tenant: Tenant = {
      businessType: input.businessType,
      createdAt: now,
      id: input.id,
      initialOwnerUserId: input.initialOwnerUserId,
      name: input.name,
      status: input.status,
      timezone: input.timezone,
      updatedAt: now
    };

    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) ?? null;
  }

  async updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);

    if (!tenant) {
      return null;
    }

    const updatedTenant: Tenant = {
      ...tenant,
      businessType: input.businessType ?? tenant.businessType,
      name: input.name ?? tenant.name,
      timezone: input.timezone ?? tenant.timezone,
      updatedAt: new Date()
    };

    this.tenants.set(id, updatedTenant);
    return updatedTenant;
  }

  async deactivateTenant(id: string): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);

    if (!tenant) {
      return null;
    }

    const deactivatedTenant: Tenant = {
      ...tenant,
      status: "DEACTIVATED",
      updatedAt: new Date()
    };

    this.tenants.set(id, deactivatedTenant);
    return deactivatedTenant;
  }

  getTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }
}
