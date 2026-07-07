import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InMemoryBusinessHoursRepository } from "../../test/in-memory-business-hours.repository";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { InMemoryServiceRepository } from "../../test/in-memory-service.repository";
import { InMemoryStaffRepository } from "../../test/in-memory-staff.repository";
import { SERVICE_REPOSITORY } from "../services/service.repository";
import { STAFF_REPOSITORY } from "../staff/staff.repository";
import { BUSINESS_HOURS_REPOSITORY } from "./business-hours.repository";
import { BUSINESS_REPOSITORY } from "./business.repository";
import { BusinessesService } from "./businesses.service";

describe("BusinessesService", () => {
  let businessHoursRepository: InMemoryBusinessHoursRepository;
  let repository: InMemoryBusinessRepository;
  let serviceRepository: InMemoryServiceRepository;
  let staffRepository: InMemoryStaffRepository;
  let service: BusinessesService;

  beforeEach(async () => {
    businessHoursRepository = new InMemoryBusinessHoursRepository();
    repository = new InMemoryBusinessRepository();
    serviceRepository = new InMemoryServiceRepository();
    staffRepository = new InMemoryStaffRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BusinessesService,
        {
          provide: BUSINESS_REPOSITORY,
          useValue: repository
        },
        {
          provide: BUSINESS_HOURS_REPOSITORY,
          useValue: businessHoursRepository
        },
        {
          provide: SERVICE_REPOSITORY,
          useValue: serviceRepository
        },
        {
          provide: STAFF_REPOSITORY,
          useValue: staffRepository
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
      bookingIntervalMinutes: 15,
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
    await expect(businessHoursRepository.findBusinessHours(business.id)).resolves.toHaveLength(7);
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

  it("rejects invalid IANA timezone names", async () => {
    await expect(
      service.createBusiness({
        businessType: "BARBER",
        name: "Bad Timezone Business",
        ownerUserId: "user-1",
        timezone: "Asia/Israel"
      })
    ).rejects.toThrow(BadRequestException);

    const business = await service.createBusiness({
      businessType: "BARBER",
      name: "Good Timezone Business",
      ownerUserId: "user-1",
      timezone: "Asia/Jerusalem"
    });

    await expect(
      service.updateBusiness({
        businessId: business.id,
        requesterUserId: "user-1",
        timezone: "Not/AZone"
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("reports publish readiness and publishes when requirements are met", async () => {
    const business = await service.createBusiness({
      businessType: "BARBER",
      name: "Ready Barber",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    await expect(service.getPublishReadiness(business.id, "user-1")).resolves.toMatchObject({
      canPublish: false,
      missingSteps: expect.arrayContaining(["Add at least one service", "Add at least one staff member", "Add a city so customers can find you"])
    });

    await serviceRepository.createService({
      businessId: business.id,
      description: "Classic cut",
      durationMinutes: 30,
      id: "service-1",
      name: "Haircut",
      price: 15
    });
    await staffRepository.createStaffMember({
      businessId: business.id,
      displayName: "Alex",
      id: "staff-1",
      userId: "staff-user-1"
    });
    await service.updateBusiness({
      businessId: business.id,
      city: "Amman",
      requesterUserId: "user-1"
    });

    await expect(service.getPublishReadiness(business.id, "user-1")).resolves.toMatchObject({
      canPublish: true,
      missingSteps: []
    });

    await expect(service.publishBusiness(business.id, "user-1")).resolves.toMatchObject({
      status: "ACTIVE"
    });
  });

  it("rejects publish when requirements are missing", async () => {
    const business = await service.createBusiness({
      businessType: "BARBER",
      name: "Incomplete Barber",
      ownerUserId: "user-1",
      timezone: "Asia/Amman"
    });

    await expect(service.publishBusiness(business.id, "user-1")).rejects.toThrow(BadRequestException);
  });
});
