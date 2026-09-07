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

  it("rejects duplicate active name and phone numbers within the same business", async () => {
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
        displayName: "Maria Lopez",
        phoneNumber: "(555) 123-4567",
        requesterUserId: "owner-user"
      })
    ).rejects.toThrow(ConflictException);
  });

  // Guest booking and account linking deliberately allow one linked and one unlinked
  // client to share a business, phone, and name. Owner edits must be scoped to one class
  // so those twins do not report each other as duplicates.
  describe("with a linked and an unlinked twin", () => {
    async function seedTwins(businessId: string): Promise<{ linked: string; unlinked: string }> {
      const unlinked = await clientRepository.createClient({
        businessId,
        displayName: "Maria Lopez",
        email: null,
        id: randomUUID(),
        linkedUserId: null,
        phoneNumber: "555-123-4567"
      });
      const linked = await clientRepository.createClient({
        businessId,
        displayName: "Maria Lopez",
        email: null,
        id: randomUUID(),
        linkedUserId: randomUUID(),
        phoneNumber: "555-123-4567"
      });

      return { linked: linked.id, unlinked: unlinked.id };
    }

    it("lets the owner edit the unlinked record without tripping on the linked one", async () => {
      const business = await createBusiness(businessRepository);
      const twins = await seedTwins(business.id);

      await expect(
        service.updateClient({
          businessId: business.id,
          clientId: twins.unlinked,
          email: "maria@example.com",
          requesterUserId: "owner-user"
        })
      ).resolves.toMatchObject({ email: "maria@example.com", linkedUserId: null });
    });

    it("lets the owner edit the linked record without tripping on the unlinked one", async () => {
      const business = await createBusiness(businessRepository);
      const twins = await seedTwins(business.id);

      await expect(
        service.updateClient({
          businessId: business.id,
          clientId: twins.linked,
          phoneNumber: "(555) 123-4567",
          requesterUserId: "owner-user"
        })
      ).resolves.toMatchObject({ phoneNumber: "(555) 123-4567" });
    });

    it("still rejects an edit that collides with another client in the same class", async () => {
      const business = await createBusiness(businessRepository);
      await seedTwins(business.id);
      const other = await service.createClient({
        businessId: business.id,
        displayName: "Maria Lopez",
        phoneNumber: "555-999-0000",
        requesterUserId: "owner-user"
      });

      await expect(
        service.updateClient({
          businessId: business.id,
          clientId: other.id,
          phoneNumber: "(555) 123-4567",
          requesterUserId: "owner-user"
        })
      ).rejects.toThrow(ConflictException);
    });

    it("still rejects creating a second unlinked client with the same identity", async () => {
      const business = await createBusiness(businessRepository);
      await seedTwins(business.id);

      await expect(
        service.createClient({
          businessId: business.id,
          displayName: "Maria Lopez",
          phoneNumber: "(555) 123-4567",
          requesterUserId: "owner-user"
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  it("allows the same phone number with a different display name", async () => {
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
    ).resolves.toMatchObject({
      displayName: "Maria L.",
      linkedUserId: null,
      phoneNumber: "(555) 123-4567"
    });
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

  it("normalizes guest identity without creating a client", () => {
    const identity = service.normalizeGuestClient({
      businessId: "business-1",
      displayName: "  Maria Lopez ",
      phoneNumber: "555-123-4567"
    });

    expect(identity).toEqual({
      businessId: "business-1",
      displayName: "Maria Lopez",
      normalizedPhone: "5551234567",
      phoneNumber: "555-123-4567"
    });
    expect(clientRepository.getClients()).toEqual([]);
  });

  it("rejects guest clients without a usable phone number", () => {
    expect(() =>
      service.normalizeGuestClient({
        businessId: "business-1",
        displayName: "Maria Lopez",
        phoneNumber: "   "
      })
    ).toThrow(BadRequestException);
    expect(() =>
      service.normalizeGuestClient({
        businessId: "business-1",
        displayName: "Maria Lopez",
        phoneNumber: "abc"
      })
    ).toThrow(BadRequestException);
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
