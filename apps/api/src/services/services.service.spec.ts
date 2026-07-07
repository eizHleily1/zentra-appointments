import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { BUSINESS_REPOSITORY } from "../businesses/business.repository";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { InMemoryServiceRepository } from "../../test/in-memory-service.repository";
import { SERVICE_REPOSITORY } from "./service.repository";
import { ServicesService } from "./services.service";

describe("ServicesService", () => {
  let businessRepository: InMemoryBusinessRepository;
  let service: ServicesService;
  let serviceRepository: InMemoryServiceRepository;

  beforeEach(async () => {
    businessRepository = new InMemoryBusinessRepository();
    serviceRepository = new InMemoryServiceRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: BUSINESS_REPOSITORY,
          useValue: businessRepository
        },
        {
          provide: SERVICE_REPOSITORY,
          useValue: serviceRepository
        }
      ]
    }).compile();

    service = moduleRef.get(ServicesService);
  });

  it("creates a service for a business member", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");

    const createdService = await service.createService({
      businessId: business.id,
      description: "Classic haircut",
      durationMinutes: 30,
      name: " Haircut ",
      price: 15,
      userId: "user-1"
    });

    expect(createdService).toMatchObject({
      active: true,
      businessId: business.id,
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15
    });
  });

  it("lists only services for the requested business", async () => {
    const firstBusiness = await createBusinessForUser(businessRepository, "user-1");
    const secondBusiness = await createBusinessForUser(businessRepository, "user-1");
    const firstService = await service.createService({
      businessId: firstBusiness.id,
      description: "First",
      durationMinutes: 30,
      name: "First Service",
      price: 10,
      userId: "user-1"
    });
    await service.createService({
      businessId: secondBusiness.id,
      description: "Second",
      durationMinutes: 45,
      name: "Second Service",
      price: 20,
      userId: "user-1"
    });

    await expect(service.findServicesForBusiness(firstBusiness.id, "user-1")).resolves.toEqual([firstService]);
  });

  it("rejects users without business access", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");

    await expect(
      service.createService({
        businessId: business.id,
        description: "Classic haircut",
        durationMinutes: 30,
        name: "Haircut",
        price: 15,
        userId: "user-2"
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("updates and deactivates a service without deleting it", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");
    const createdService = await service.createService({
      businessId: business.id,
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15,
      userId: "user-1"
    });

    await expect(
      service.updateService({
        businessId: business.id,
        description: "Updated description",
        durationMinutes: 45,
        name: "Premium Haircut",
        price: 25,
        serviceId: createdService.id,
        userId: "user-1"
      })
    ).resolves.toMatchObject({
      description: "Updated description",
      durationMinutes: 45,
      name: "Premium Haircut",
      price: 25
    });

    await expect(service.deactivateService(business.id, createdService.id, "user-1")).resolves.toMatchObject({
      active: false
    });
    expect(serviceRepository.getServices()).toHaveLength(1);
  });

  it("rejects whitespace-only service names", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");

    await expect(
      service.createService({
        businessId: business.id,
        description: "Invalid",
        durationMinutes: 30,
        name: "   ",
        price: 15,
        userId: "user-1"
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects duplicate active service names using normalized comparison", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");

    await service.createService({
      businessId: business.id,
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15,
      userId: "user-1"
    });

    await expect(
      service.createService({
        businessId: business.id,
        description: "Duplicate",
        durationMinutes: 30,
        name: " haircut ",
        userId: "user-1"
      })
    ).rejects.toThrow(ConflictException);
  });

  it("allows creating a service without a price", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");

    await expect(
      service.createService({
        businessId: business.id,
        description: "Free consultation",
        durationMinutes: 30,
        name: "Consultation",
        userId: "user-1"
      })
    ).resolves.toMatchObject({
      name: "Consultation",
      price: null
    });
  });

  it("excludes deactivated services from normal lists and allows name reuse", async () => {
    const business = await createBusinessForUser(businessRepository, "user-1");
    const createdService = await service.createService({
      businessId: business.id,
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15,
      userId: "user-1"
    });

    await service.deactivateService(business.id, createdService.id, "user-1");

    await expect(service.findServicesForBusiness(business.id, "user-1")).resolves.toEqual([]);

    await expect(
      service.createService({
        businessId: business.id,
        description: "New haircut",
        durationMinutes: 30,
        name: "Haircut",
        price: 20,
        userId: "user-1"
      })
    ).resolves.toMatchObject({
      active: true,
      name: "Haircut",
      price: 20
    });
  });
});

async function createBusinessForUser(repository: InMemoryBusinessRepository, userId: string) {
  const result = await repository.createBusinessWithOwnerMembership({
    businessType: "BARBER",
    id: randomUUID(),
    initialOwnerUserId: userId,
    membershipId: randomUUID(),
    name: `${userId} Business`,
    timezone: "Asia/Amman"
  });

  return result.business;
}
