import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { BUSINESS_REPOSITORY } from "./business.repository";
import { BusinessesService } from "./businesses.service";

describe("BusinessesService", () => {
  let repository: InMemoryBusinessRepository;
  let service: BusinessesService;

  beforeEach(async () => {
    repository = new InMemoryBusinessRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BusinessesService,
        {
          provide: BUSINESS_REPOSITORY,
          useValue: repository
        }
      ]
    }).compile();

    service = moduleRef.get(BusinessesService);
  });

  it("creates a business with exactly one owner membership", async () => {
    const business = await service.createBusiness({
      businessType: "BARBER",
      name: " Ahmad Barber ",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    expect(business).toMatchObject({
      businessType: "BARBER",
      initialOwnerUserId: "user-1",
      name: "Ahmad Barber",
      status: "PENDING_ONBOARDING",
      timezone: "Asia/Amman"
    });
    expect(repository.getMemberships()).toEqual([
      expect.objectContaining({
        businessId: business.id,
        role: "OWNER",
        userId: "user-1"
      })
    ]);
  });

  it("returns only businesses connected through memberships", async () => {
    const firstBusiness = await service.createBusiness({
      businessType: "BARBER",
      name: "First Business",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });
    await service.createBusiness({
      businessType: "SALON",
      name: "Second Business",
      ownerUserId: "user-2",
      timezone: "Asia/Amman"
    });

    await expect(service.findMyBusinesses("user-1")).resolves.toEqual([firstBusiness]);
  });

  it("allows business details for members only", async () => {
    const business = await service.createBusiness({
      businessType: "CLINIC",
      name: "Clinic",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    await expect(service.getBusinessDetails(business.id, "user-1")).resolves.toEqual(business);
    await expect(service.getBusinessDetails(business.id, "user-2")).rejects.toThrow(NotFoundException);
  });

  it("allows updates and deactivation only for owner memberships", async () => {
    const business = await service.createBusiness({
      businessType: "CONSULTANT",
      name: "Consulting",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });
    repository.addMembership("user-2", business.id, "CLIENT");

    await expect(
      service.updateBusiness({
        businessId: business.id,
        name: "Client Update",
        requesterUserId: "user-2"
      })
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.updateBusiness({
        businessId: business.id,
        name: "Owner Update",
        requesterUserId: "user-1"
      })
    ).resolves.toMatchObject({ name: "Owner Update" });

    await expect(service.deactivateBusiness(business.id, "user-1")).resolves.toMatchObject({ status: "DEACTIVATED" });
  });

  it("rejects whitespace-only business names", async () => {
    await expect(
      service.createBusiness({
        businessType: "OTHER",
        name: "   ",
        ownerUserId: "user-1",
        timezone: "Asia/Amman"
      })
    ).rejects.toThrow(BadRequestException);
  });
});
