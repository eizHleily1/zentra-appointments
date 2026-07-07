import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { InMemoryBusinessHoursRepository } from "../../test/in-memory-business-hours.repository";
import { BUSINESS_HOURS_REPOSITORY } from "../businesses/business-hours.repository";
import { BUSINESS_REPOSITORY } from "../businesses/business.repository";
import { createDefaultBusinessHours } from "../businesses/default-business-hours";
import { SERVICE_REPOSITORY } from "../services/service.repository";
import { STAFF_REPOSITORY } from "../staff/staff.repository";
import { InMemoryAppointmentRepository } from "../../test/in-memory-appointment.repository";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { InMemoryServiceRepository } from "../../test/in-memory-service.repository";
import { InMemoryClientRepository } from "../../test/in-memory-client.repository";
import { CLIENT_REPOSITORY } from "../clients/client.repository";
import { ClientsService } from "../clients/clients.service";
import { InMemoryStaffRepository } from "../../test/in-memory-staff.repository";
import { APPOINTMENT_REPOSITORY } from "./appointment.repository";
import { AppointmentsService } from "./appointments.service";
import { zonedLocalToUtc } from "./scheduling";

const TEST_DATE = "2030-07-02";
const CLOSED_TEST_DATE = "2030-07-06";

describe("AppointmentsService", () => {
  let appointmentRepository: InMemoryAppointmentRepository;
  let businessHoursRepository: InMemoryBusinessHoursRepository;
  let businessRepository: InMemoryBusinessRepository;
  let clientRepository: InMemoryClientRepository;
  let service: AppointmentsService;
  let serviceRepository: InMemoryServiceRepository;
  let staffRepository: InMemoryStaffRepository;

  beforeEach(async () => {
    appointmentRepository = new InMemoryAppointmentRepository();
    businessHoursRepository = new InMemoryBusinessHoursRepository();
    businessRepository = new InMemoryBusinessRepository();
    serviceRepository = new InMemoryServiceRepository();
    staffRepository = new InMemoryStaffRepository();
    clientRepository = new InMemoryClientRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        ClientsService,
        {
          provide: APPOINTMENT_REPOSITORY,
          useValue: appointmentRepository
        },
        {
          provide: BUSINESS_REPOSITORY,
          useValue: businessRepository
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
        },
        {
          provide: CLIENT_REPOSITORY,
          useValue: clientRepository
        }
      ]
    }).compile();

    service = moduleRef.get(AppointmentsService);
  });

  it("creates a booked appointment with computed end time from service duration", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const startTime = buildStartTime(TEST_DATE, "10:00");

    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime
    });

    expect(appointment).toMatchObject({
      businessId: business.id,
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member",
      status: "BOOKED"
    });
    expect(appointment.endsAt.toISOString()).toBe(buildStartTime(TEST_DATE, "10:30"));
  });

  it("uses a 10-minute service duration when computing end time", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      durationMinutes: 10,
      serviceName: "Beard",
      serviceRepository,
      staffRepository
    });
    const startTime = buildStartTime(TEST_DATE, "10:00");

    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime
    });

    expect(appointment.serviceDurationMinutes).toBe(10);
    expect(appointment.endsAt.toISOString()).toBe(buildStartTime(TEST_DATE, "10:10"));
  });

  it("keeps appointment snapshot values after later service and staff updates", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await serviceRepository.updateService(business.id, businessService.id, {
      durationMinutes: 45,
      name: "Premium Haircut",
      price: 25
    });
    await staffRepository.updateStaffMember(business.id, staffMember.id, {
      displayName: "Updated Staff"
    });

    await expect(service.getAppointmentDetails(business.id, appointment.id, "owner-user")).resolves.toMatchObject({
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member"
    });
  });

  it("rejects overlapping appointments for the same staff member", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });

    await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:15")
      })
    ).rejects.toThrow(ConflictException);
  });

  it("allows booking a slot after the previous appointment was cancelled", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await service.cancelAppointment(business.id, appointment.id, "owner-user");

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).resolves.toMatchObject({ status: "BOOKED" });
  });

  it("returns no available slots on closed days", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });

    await expect(
      service.getAvailableSlots({
        businessId: business.id,
        date: CLOSED_TEST_DATE,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id
      })
    ).resolves.toEqual([]);
  });

  it("returns available slots inside business hours", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });

    const slots = await service.getAvailableSlots({
      businessId: business.id,
      date: TEST_DATE,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toEqual(
      expect.objectContaining({
        endTime: expect.any(String),
        label: expect.any(String),
        startTime: expect.any(String)
      })
    );
  });

  it("rejects appointments when service or staff are outside the business", async () => {
    const firstSetup = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const secondSetup = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      ownerUserId: "owner-user",
      serviceName: "Second Service",
      serviceRepository,
      staffDisplayName: "Second Staff",
      staffRepository
    });

    await expect(
      service.createAppointment({
        businessId: firstSetup.business.id,
        clientId: firstSetup.client.id,
        requesterUserId: "owner-user",
        serviceId: secondSetup.businessService.id,
        staffMemberId: firstSetup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.createAppointment({
        businessId: firstSetup.business.id,
        clientId: firstSetup.client.id,
        requesterUserId: "owner-user",
        serviceId: firstSetup.businessService.id,
        staffMemberId: secondSetup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("prevents users without business access from accessing appointments", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "other-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("cancels and completes booked appointments", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const toCancel = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });
    const toComplete = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "11:00")
    });

    await expect(service.cancelAppointment(business.id, toCancel.id, "owner-user")).resolves.toMatchObject({
      status: "CANCELLED"
    });
    await expect(service.completeAppointment(business.id, toComplete.id, "owner-user")).resolves.toMatchObject({
      status: "COMPLETED"
    });
  });

  it("treats cancelled and completed appointments as terminal", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const cancelled = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });
    const completed = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "11:00")
    });

    await service.cancelAppointment(business.id, cancelled.id, "owner-user");
    await service.completeAppointment(business.id, completed.id, "owner-user");

    await expect(service.completeAppointment(business.id, cancelled.id, "owner-user")).rejects.toThrow(
      ConflictException
    );
    await expect(service.cancelAppointment(business.id, cancelled.id, "owner-user")).rejects.toThrow(
      ConflictException
    );
    await expect(service.cancelAppointment(business.id, completed.id, "owner-user")).rejects.toThrow(
      ConflictException
    );
    await expect(service.completeAppointment(business.id, completed.id, "owner-user")).rejects.toThrow(
      ConflictException
    );
  });

  it("allows exactly adjacent appointments but rejects one-minute overlaps", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });

    await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:30")
      })
    ).resolves.toMatchObject({ status: "BOOKED" });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:29")
      })
    ).rejects.toThrow(ConflictException);

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(ConflictException);
  });

  it("allows different staff members to be booked at the same time", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const secondStaffMember = await staffRepository.createStaffMember({
      businessId: business.id,
      displayName: "Second Staff",
      id: randomUUID(),
      userId: randomUUID()
    });

    await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: secondStaffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).resolves.toMatchObject({ status: "BOOKED" });
  });

  it("rejects appointments that start in the past", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime("2020-07-01", "10:00")
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects booking an inactive service or staff member", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    await serviceRepository.deactivateService(business.id, businessService.id);

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(BadRequestException);

    const activeService = await serviceRepository.createService({
      businessId: business.id,
      description: "Second service",
      durationMinutes: 30,
      id: randomUUID(),
      name: "Second Service",
      price: 10
    });
    await staffRepository.deactivateStaffMember(business.id, staffMember.id);

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: activeService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("stores a null price snapshot for services without a price", async () => {
    const { business, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const freeService = await serviceRepository.createService({
      businessId: business.id,
      description: "Free consultation",
      durationMinutes: 30,
      id: randomUUID(),
      name: "Consultation",
      price: null
    });

    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: freeService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    expect(appointment.servicePrice).toBeNull();
  });

  it("falls back to default business hours when none are stored", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    await businessHoursRepository.replaceBusinessHours(business.id, []);

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).resolves.toMatchObject({ status: "BOOKED" });
  });

  it("stores client snapshot values when booking", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientDisplayName: "Maria Lopez",
      clientPhoneNumber: "+1 (555) 123-4567",
      clientRepository,
      serviceRepository,
      staffRepository
    });

    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    expect(appointment).toMatchObject({
      clientDisplayName: "Maria Lopez",
      clientId: client.id,
      clientPhoneNumber: "+1 (555) 123-4567"
    });
  });

  it("keeps appointment client snapshots after the client record changes", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientDisplayName: "Maria Lopez",
      clientPhoneNumber: "+1 555-123-4567",
      clientRepository,
      serviceRepository,
      staffRepository
    });
    const appointment = await service.createAppointment({
      businessId: business.id,
      clientId: client.id,
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await clientRepository.updateClient(business.id, client.id, {
      displayName: "Maria L.",
      phoneNumber: "+1 555-999-0000"
    });

    await expect(service.getAppointmentDetails(business.id, appointment.id, "owner-user")).resolves.toMatchObject({
      clientDisplayName: "Maria Lopez",
      clientPhoneNumber: "+1 555-123-4567"
    });
  });

  it("rejects booking for inactive clients", async () => {
    const { business, businessService, client, staffMember } = await createBookableSetup({
      businessHoursRepository,
      businessRepository,
      clientRepository,
      serviceRepository,
      staffRepository
    });
    await clientRepository.deactivateClient(business.id, client.id);

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientId: client.id,
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
    ).rejects.toThrow(BadRequestException);
  });
});

async function createBookableSetup(input: {
  businessHoursRepository: InMemoryBusinessHoursRepository;
  businessRepository: InMemoryBusinessRepository;
  clientDisplayName?: string;
  clientPhoneNumber?: string | null;
  clientRepository: InMemoryClientRepository;
  durationMinutes?: number;
  ownerUserId?: string;
  serviceName?: string;
  serviceRepository: InMemoryServiceRepository;
  staffDisplayName?: string;
  staffRepository: InMemoryStaffRepository;
}) {
  const ownerUserId = input.ownerUserId ?? "owner-user";
  const businessResult = await input.businessRepository.createBusinessWithOwnerMembership({
    businessType: "BARBER",
    id: randomUUID(),
    initialOwnerUserId: ownerUserId,
    membershipId: randomUUID(),
    name: `${ownerUserId} Business`,
    timezone: "Asia/Amman"
  });
  await input.businessHoursRepository.replaceBusinessHours(
    businessResult.business.id,
    createDefaultBusinessHours(businessResult.business.id)
  );
  const businessService = await input.serviceRepository.createService({
    businessId: businessResult.business.id,
    description: "Classic haircut",
    durationMinutes: input.durationMinutes ?? 30,
    id: randomUUID(),
    name: input.serviceName ?? "Haircut",
    price: 15
  });
  const staffMember = await input.staffRepository.createStaffMember({
    businessId: businessResult.business.id,
    displayName: input.staffDisplayName ?? "Staff Member",
    id: randomUUID(),
    userId: randomUUID()
  });
  const client = await input.clientRepository.createClient({
    businessId: businessResult.business.id,
    displayName: input.clientDisplayName ?? "Jane Customer",
    email: null,
    id: randomUUID(),
    linkedUserId: null,
    phoneNumber: input.clientPhoneNumber ?? null
  });

  return { business: businessResult.business, businessService, client, staffMember };
}

function buildStartTime(date: string, time: string): string {
  return zonedLocalToUtc(`${date}T${time}:00`, "Asia/Amman").toISOString();
}
