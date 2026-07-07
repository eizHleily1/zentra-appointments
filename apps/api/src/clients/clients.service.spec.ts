import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { APPOINTMENT_REPOSITORY } from "../appointments/appointment.repository";
import { InMemoryAppointmentRepository } from "../../test/in-memory-appointment.repository";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { InMemoryClientRepository } from "../../test/in-memory-client.repository";
import { BUSINESS_REPOSITORY } from "../businesses/business.repository";
import { CLIENT_REPOSITORY } from "./client.repository";
import { ClientsService } from "./clients.service";
import { zonedLocalToUtc } from "../appointments/scheduling";

describe("ClientsService", () => {
  let appointmentRepository: InMemoryAppointmentRepository;
  let businessRepository: InMemoryBusinessRepository;
  let clientRepository: InMemoryClientRepository;
  let service: ClientsService;

  beforeEach(async () => {
    appointmentRepository = new InMemoryAppointmentRepository();
    businessRepository = new InMemoryBusinessRepository();
    clientRepository = new InMemoryClientRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: BUSINESS_REPOSITORY,
          useValue: businessRepository
        },
        {
          provide: CLIENT_REPOSITORY,
          useValue: clientRepository
        },
        {
          provide: APPOINTMENT_REPOSITORY,
          useValue: appointmentRepository
        }
      ]
    }).compile();

    service = moduleRef.get(ClientsService);
  });

  it("creates clients for a business member", async () => {
    const business = await createBusiness(businessRepository);

    const client = await service.createClient({
      businessId: business.id,
      displayName: "Maria Lopez",
      email: "maria@example.com",
      phoneNumber: "+1 555-123-4567",
      requesterUserId: "owner-user"
    });

    expect(client).toMatchObject({
      active: true,
      businessId: business.id,
      displayName: "Maria Lopez",
      email: "maria@example.com",
      linkedUserId: null,
      phoneNumber: "+1 555-123-4567"
    });
  });

  it("rejects duplicate active phone numbers within the same business", async () => {
    const business = await createBusiness(businessRepository);

    await service.createClient({
      businessId: business.id,
      displayName: "Maria Lopez",
      phoneNumber: "555-123-4567",
      requesterUserId: "owner-user"
    });

    await expect(
      service.createClient({
        businessId: business.id,
        displayName: "Maria L.",
        phoneNumber: "(555) 123-4567",
        requesterUserId: "owner-user"
      })
    ).rejects.toThrow(ConflictException);
  });

  it("allows duplicate names when no phone number is provided", async () => {
    const business = await createBusiness(businessRepository);

    await service.createClient({
      businessId: business.id,
      displayName: "Walk-in Customer",
      requesterUserId: "owner-user"
    });

    await expect(
      service.createClient({
        businessId: business.id,
        displayName: "Walk-in Customer",
        requesterUserId: "owner-user"
      })
    ).resolves.toMatchObject({ displayName: "Walk-in Customer" });
  });

  it("searches clients by name and phone", async () => {
    const business = await createBusiness(businessRepository);

    await service.createClient({
      businessId: business.id,
      displayName: "Maria Lopez",
      phoneNumber: "+1 555-123-4567",
      requesterUserId: "owner-user"
    });
    await service.createClient({
      businessId: business.id,
      displayName: "John Smith",
      requesterUserId: "owner-user"
    });

    await expect(service.findClientsForBusiness(business.id, "owner-user", "maria")).resolves.toHaveLength(1);
    await expect(service.findClientsForBusiness(business.id, "owner-user", "555123")).resolves.toHaveLength(1);
  });

  it("keeps clients scoped to their owning business", async () => {
    const firstBusiness = await createBusiness(businessRepository, "owner-user");
    const secondBusiness = await createBusiness(businessRepository, "owner-user");
    const client = await service.createClient({
      businessId: firstBusiness.id,
      displayName: "Maria Lopez",
      requesterUserId: "owner-user"
    });

    await expect(service.getClientDetails(secondBusiness.id, client.id, "owner-user")).rejects.toThrow(
      NotFoundException
    );
  });

  it("deactivates clients and excludes them from active search results", async () => {
    const business = await createBusiness(businessRepository);
    const client = await service.createClient({
      businessId: business.id,
      displayName: "Maria Lopez",
      requesterUserId: "owner-user"
    });

    await service.deactivateClient(business.id, client.id, "owner-user");

    await expect(service.findClientsForBusiness(business.id, "owner-user")).resolves.toEqual([]);
    await expect(service.getActiveClientForBooking(business.id, client.id)).rejects.toThrow(BadRequestException);
  });

  it("returns appointment summaries and history using snapshot data", async () => {
    const business = await createBusiness(businessRepository);
    const client = await service.createClient({
      businessId: business.id,
      displayName: "Maria Lopez",
      phoneNumber: "+1 555-123-4567",
      requesterUserId: "owner-user"
    });

    await appointmentRepository.createAppointment({
      businessId: business.id,
      clientDisplayName: "Maria Lopez",
      clientId: client.id,
      clientPhoneNumber: "+1 555-123-4567",
      endsAt: zonedLocalToUtc("2030-07-02T10:30:00", "Asia/Amman"),
      id: randomUUID(),
      serviceDurationMinutes: 30,
      serviceId: randomUUID(),
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff",
      staffMemberId: randomUUID(),
      startsAt: zonedLocalToUtc("2030-07-02T10:00:00", "Asia/Amman")
    });

    await service.updateClient({
      businessId: business.id,
      clientId: client.id,
      displayName: "Maria L.",
      phoneNumber: "+1 555-000-1111",
      requesterUserId: "owner-user"
    });

    const summaries = await service.findClientsForBusiness(business.id, "owner-user");
    expect(summaries).toEqual([
      expect.objectContaining({
        displayName: "Maria L.",
        lastAppointmentAt: zonedLocalToUtc("2030-07-02T10:00:00", "Asia/Amman"),
        totalAppointments: 1
      })
    ]);

    const details = await service.getClientDetails(business.id, client.id, "owner-user");
    expect(details.appointments).toHaveLength(1);
    expect(details.appointments[0]).toMatchObject({
      clientDisplayName: "Maria Lopez",
      clientPhoneNumber: "+1 555-123-4567"
    });
  });
});

async function createBusiness(repository: InMemoryBusinessRepository, ownerUserId = "owner-user") {
  const result = await repository.createBusinessWithOwnerMembership({
    businessType: "BARBER",
    id: randomUUID(),
    initialOwnerUserId: ownerUserId,
    membershipId: randomUUID(),
    name: `${ownerUserId} Business`,
    timezone: "Asia/Amman"
  });

  return result.business;
}
