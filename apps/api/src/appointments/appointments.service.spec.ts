import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { BUSINESS_REPOSITORY } from "../businesses/business.repository";
import { SERVICE_REPOSITORY } from "../services/service.repository";
import { STAFF_REPOSITORY } from "../staff/staff.repository";
import { InMemoryAppointmentRepository } from "../../test/in-memory-appointment.repository";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { InMemoryServiceRepository } from "../../test/in-memory-service.repository";
import { InMemoryStaffRepository } from "../../test/in-memory-staff.repository";
import { APPOINTMENT_REPOSITORY } from "./appointment.repository";
import { AppointmentsService } from "./appointments.service";

describe("AppointmentsService", () => {
  let appointmentRepository: InMemoryAppointmentRepository;
  let businessRepository: InMemoryBusinessRepository;
  let service: AppointmentsService;
  let serviceRepository: InMemoryServiceRepository;
  let staffRepository: InMemoryStaffRepository;

  beforeEach(async () => {
    appointmentRepository = new InMemoryAppointmentRepository();
    businessRepository = new InMemoryBusinessRepository();
    serviceRepository = new InMemoryServiceRepository();
    staffRepository = new InMemoryStaffRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: APPOINTMENT_REPOSITORY,
          useValue: appointmentRepository
        },
        {
          provide: BUSINESS_REPOSITORY,
          useValue: businessRepository
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

    service = moduleRef.get(AppointmentsService);
  });

  it("creates a booked appointment with service and staff snapshots", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessRepository,
      serviceRepository,
      staffRepository
    });

    const appointment = await service.createAppointment({
      businessId: business.id,
      clientUserId: randomUUID(),
      endsAt: "2026-07-01T10:30:00.000Z",
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startsAt: "2026-07-01T10:00:00.000Z"
    });

    expect(appointment).toMatchObject({
      businessId: business.id,
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member",
      status: "BOOKED"
    });
  });

  it("keeps appointment snapshot values after later service and staff updates", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessRepository,
      serviceRepository,
      staffRepository
    });
    const appointment = await service.createAppointment({
      businessId: business.id,
      clientUserId: randomUUID(),
      endsAt: "2026-07-01T10:30:00.000Z",
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startsAt: "2026-07-01T10:00:00.000Z"
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

  it("rejects appointments when service or staff are outside the business", async () => {
    const firstSetup = await createBookableSetup({ businessRepository, serviceRepository, staffRepository });
    const secondSetup = await createBookableSetup({
      businessRepository,
      ownerUserId: "owner-user",
      serviceName: "Second Service",
      serviceRepository,
      staffDisplayName: "Second Staff",
      staffRepository
    });

    await expect(
      service.createAppointment({
        businessId: firstSetup.business.id,
        clientUserId: randomUUID(),
        endsAt: "2026-07-01T10:30:00.000Z",
        requesterUserId: "owner-user",
        serviceId: secondSetup.businessService.id,
        staffMemberId: firstSetup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.createAppointment({
        businessId: firstSetup.business.id,
        clientUserId: randomUUID(),
        endsAt: "2026-07-01T10:30:00.000Z",
        requesterUserId: "owner-user",
        serviceId: firstSetup.businessService.id,
        staffMemberId: secondSetup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("prevents users without business access from accessing appointments", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessRepository,
      serviceRepository,
      staffRepository
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientUserId: randomUUID(),
        endsAt: "2026-07-01T10:30:00.000Z",
        requesterUserId: "other-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("cancels and completes appointments with status changes", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessRepository,
      serviceRepository,
      staffRepository
    });
    const appointment = await service.createAppointment({
      businessId: business.id,
      clientUserId: randomUUID(),
      endsAt: "2026-07-01T10:30:00.000Z",
      requesterUserId: "owner-user",
      serviceId: businessService.id,
      staffMemberId: staffMember.id,
      startsAt: "2026-07-01T10:00:00.000Z"
    });

    await expect(service.cancelAppointment(business.id, appointment.id, "owner-user")).resolves.toMatchObject({
      status: "CANCELLED"
    });
    await expect(service.completeAppointment(business.id, appointment.id, "owner-user")).resolves.toMatchObject({
      status: "COMPLETED"
    });
  });

  it("rejects an appointment whose end time is not after its start time", async () => {
    const { business, businessService, staffMember } = await createBookableSetup({
      businessRepository,
      serviceRepository,
      staffRepository
    });

    await expect(
      service.createAppointment({
        businessId: business.id,
        clientUserId: randomUUID(),
        endsAt: "2026-07-01T10:00:00.000Z",
        requesterUserId: "owner-user",
        serviceId: businessService.id,
        staffMemberId: staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
    ).rejects.toThrow(BadRequestException);
  });
});

async function createBookableSetup(input: {
  businessRepository: InMemoryBusinessRepository;
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
  const businessService = await input.serviceRepository.createService({
    businessId: businessResult.business.id,
    description: "Classic haircut",
    durationMinutes: 30,
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

  return { business: businessResult.business, businessService, staffMember };
}
