import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InMemoryTenantRepository } from "../../test/in-memory-tenant.repository";
import { TENANT_REPOSITORY } from "./tenant.repository";
import { TenantsService } from "./tenants.service";

describe("TenantsService", () => {
  let repository: InMemoryTenantRepository;
  let service: TenantsService;

  beforeEach(async () => {
    repository = new InMemoryTenantRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: TENANT_REPOSITORY,
          useValue: repository
        }
      ]
    }).compile();

    service = moduleRef.get(TenantsService);
  });

  it("creates a tenant in pending onboarding for the authenticated user", async () => {
    const tenant = await service.createTenant({
      businessType: "BARBER",
      name: "  Ahmad Barber  ",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    expect(tenant).toMatchObject({
      businessType: "BARBER",
      initialOwnerUserId: "user-1",
      name: "Ahmad Barber",
      status: "PENDING_ONBOARDING",
      timezone: "Asia/Amman"
    });
  });

  it("rejects whitespace-only tenant names", async () => {
    await expect(
      service.createTenant({
        businessType: "SALON",
        name: "   ",
        ownerUserId: "user-1",
        timezone: "Asia/Amman"
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("updates tenant metadata without changing owner reference", async () => {
    const tenant = await service.createTenant({
      businessType: "CLINIC",
      name: "Prime Therapy",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    const updatedTenant = await service.updateTenant({
      businessType: "THERAPIST",
      name: "Prime Therapy Clinic",
      requesterUserId: "user-1",
      tenantId: tenant.id,
      timezone: "Asia/Dubai"
    });

    expect(updatedTenant).toMatchObject({
      businessType: "THERAPIST",
      initialOwnerUserId: "user-1",
      name: "Prime Therapy Clinic",
      timezone: "Asia/Dubai"
    });
  });

  it("restricts updates to the initial owner reference", async () => {
    const tenant = await service.createTenant({
      businessType: "COACH",
      name: "Fit Coach Studio",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    await expect(
      service.updateTenant({
        name: "Other Name",
        requesterUserId: "user-2",
        tenantId: tenant.id
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it("deactivates a tenant while preserving the record", async () => {
    const tenant = await service.createTenant({
      businessType: "CONSULTANT",
      name: "Consulting Studio",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    const deactivatedTenant = await service.deactivateTenant(tenant.id, "user-1");

    expect(deactivatedTenant.status).toBe("DEACTIVATED");
    expect(repository.getTenants()).toHaveLength(1);
  });
});
