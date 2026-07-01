import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { BUSINESS_REPOSITORY, type BusinessRepository } from "../businesses/business.repository";
import { SERVICE_REPOSITORY, type ServiceRepository } from "../services/service.repository";
import { STAFF_REPOSITORY, type StaffRepository } from "../staff/staff.repository";
import {
  APPOINTMENT_REPOSITORY,
  type Appointment,
  type AppointmentRepository
} from "./appointment.repository";

interface CreateAppointmentCommand {
  businessId: string;
  clientUserId: string;
  endsAt: string;
  requesterUserId: string;
  serviceId: string;
  staffMemberId: string;
  startsAt: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(STAFF_REPOSITORY) private readonly staffRepository: StaffRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository
  ) {}

  async createAppointment(command: CreateAppointmentCommand): Promise<Appointment> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const startsAt = parseAppointmentDate(command.startsAt, "Appointment start time is required");
    const endsAt = parseAppointmentDate(command.endsAt, "Appointment end time is required");

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException("Appointment end time must be after start time");
    }

    const service = await this.serviceRepository.findServiceByIdForBusiness(command.businessId, command.serviceId);

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    const staffMember = await this.staffRepository.findStaffMemberByIdForBusiness(
      command.businessId,
      command.staffMemberId
    );

    if (!staffMember) {
      throw new NotFoundException("Staff member not found");
    }

    return this.appointmentRepository.createAppointment({
      businessId: command.businessId,
      clientUserId: command.clientUserId,
      endsAt,
      id: randomUUID(),
      serviceDurationMinutes: service.durationMinutes,
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      staffDisplayName: staffMember.displayName,
      staffMemberId: staffMember.id,
      startsAt
    });
  }

  async findAppointmentsForBusiness(businessId: string, requesterUserId: string): Promise<Appointment[]> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    return this.appointmentRepository.findAppointmentsForBusiness(businessId);
  }

  async getAppointmentDetails(
    businessId: string,
    appointmentId: string,
    requesterUserId: string
  ): Promise<Appointment> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const appointment = await this.appointmentRepository.findAppointmentByIdForBusiness(businessId, appointmentId);

    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    return appointment;
  }

  async cancelAppointment(businessId: string, appointmentId: string, requesterUserId: string): Promise<Appointment> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const appointment = await this.appointmentRepository.updateAppointmentStatus(businessId, appointmentId, "CANCELLED");

    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    return appointment;
  }

  async completeAppointment(businessId: string, appointmentId: string, requesterUserId: string): Promise<Appointment> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const appointment = await this.appointmentRepository.updateAppointmentStatus(businessId, appointmentId, "COMPLETED");

    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    return appointment;
  }

  private async assertBusinessAccess(userId: string, businessId: string): Promise<void> {
    const membership = await this.businessRepository.findMembership(userId, businessId);

    if (!membership) {
      throw new NotFoundException("Business not found");
    }
  }
}

function parseAppointmentDate(value: string, message: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(message);
  }

  return date;
}
