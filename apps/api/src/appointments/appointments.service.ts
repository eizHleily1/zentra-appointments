import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  BUSINESS_HOURS_REPOSITORY,
  type BusinessHoursRepository
} from "../businesses/business-hours.repository";
import { BUSINESS_REPOSITORY, type Business, type BusinessRepository } from "../businesses/business.repository";
import { createDefaultBusinessHours } from "../businesses/default-business-hours";
import type { Client } from "../clients/client.repository";
import { ClientsService } from "../clients/clients.service";
import { SERVICE_REPOSITORY, type ServiceRepository } from "../services/service.repository";
import { STAFF_REPOSITORY, type StaffRepository } from "../staff/staff.repository";
import {
  APPOINTMENT_REPOSITORY,
  type Appointment,
  type AppointmentRepository,
  type ConsumerAppointment
} from "./appointment.repository";
import {
  appointmentBlocksScheduling,
  appointmentsOverlap,
  computeAppointmentEndTime,
  generateAvailableSlots,
  getDayOfWeekForDate,
  isStartTimeWithinBusinessHours,
  type AvailableSlot,
  zonedLocalToUtc
} from "./scheduling";

interface CreateAppointmentCommand {
  businessId: string;
  clientId: string;
  requesterUserId: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
}

interface CreateConsumerAppointmentCommand {
  businessId: string;
  requesterEmail: string;
  requesterUserId: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
}

interface GetAvailableSlotsCommand {
  businessId: string;
  date: string;
  requesterUserId: string;
  serviceId: string;
  staffMemberId: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(BUSINESS_HOURS_REPOSITORY) private readonly businessHoursRepository: BusinessHoursRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(STAFF_REPOSITORY) private readonly staffRepository: StaffRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    private readonly clientsService: ClientsService
  ) {}

  async createAppointment(command: CreateAppointmentCommand): Promise<Appointment> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const business = await this.businessRepository.findBusinessByIdForUser(
      command.businessId,
      command.requesterUserId
    );

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    const client = await this.clientsService.getActiveClientForBooking(command.businessId, command.clientId);

    return this.bookAppointment({
      business,
      client,
      serviceId: command.serviceId,
      staffMemberId: command.staffMemberId,
      startTime: command.startTime
    });
  }

  async createConsumerAppointment(command: CreateConsumerAppointmentCommand): Promise<Appointment> {
    const business = await this.businessRepository.findActiveBusinessById(command.businessId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    const client = await this.clientsService.resolveLinkedClientForUser({
      businessId: command.businessId,
      userEmail: command.requesterEmail,
      userId: command.requesterUserId
    });

    return this.bookAppointment({
      business,
      client,
      serviceId: command.serviceId,
      staffMemberId: command.staffMemberId,
      startTime: command.startTime
    });
  }

  async getAvailableSlots(command: GetAvailableSlotsCommand): Promise<AvailableSlot[]> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const business = await this.businessRepository.findBusinessByIdForUser(
      command.businessId,
      command.requesterUserId
    );

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return this.computeAvailableSlots(business, command);
  }

  async getConsumerAvailableSlots(
    command: Omit<GetAvailableSlotsCommand, "requesterUserId">
  ): Promise<AvailableSlot[]> {
    const business = await this.businessRepository.findActiveBusinessById(command.businessId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return this.computeAvailableSlots(business, command);
  }

  async findAppointmentsForLinkedUser(userId: string): Promise<ConsumerAppointment[]> {
    const linkedClients = await this.clientsService.findClientsLinkedToUser(userId);
    const appointments: ConsumerAppointment[] = [];

    for (const client of linkedClients) {
      const [businessAppointments, business] = await Promise.all([
        this.appointmentRepository.findAppointmentsForBusiness(client.businessId),
        this.businessRepository.findBusinessById(client.businessId)
      ]);

      for (const appointment of businessAppointments) {
        if (appointment.clientId === client.id) {
          appointments.push({
            ...appointment,
            businessName: business?.name ?? "Business",
            businessTimezone: business?.timezone ?? "UTC"
          });
        }
      }
    }

    return appointments.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
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
    return this.transitionAppointmentStatus(businessId, appointmentId, requesterUserId, "CANCELLED");
  }

  async completeAppointment(businessId: string, appointmentId: string, requesterUserId: string): Promise<Appointment> {
    return this.transitionAppointmentStatus(businessId, appointmentId, requesterUserId, "COMPLETED");
  }

  // BOOKED is the only non-terminal status: BOOKED -> CANCELLED and
  // BOOKED -> COMPLETED are allowed, everything else is rejected.
  private async transitionAppointmentStatus(
    businessId: string,
    appointmentId: string,
    requesterUserId: string,
    nextStatus: "CANCELLED" | "COMPLETED"
  ): Promise<Appointment> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const appointment = await this.appointmentRepository.findAppointmentByIdForBusiness(businessId, appointmentId);

    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    if (appointment.status !== "BOOKED") {
      const currentLabel = appointment.status === "CANCELLED" ? "cancelled" : "completed";
      const actionLabel = nextStatus === "CANCELLED" ? "cancelled" : "completed";
      throw new ConflictException(`A ${currentLabel} appointment cannot be ${actionLabel}`);
    }

    const updatedAppointment = await this.appointmentRepository.updateAppointmentStatus(
      businessId,
      appointmentId,
      nextStatus
    );

    if (!updatedAppointment) {
      throw new NotFoundException("Appointment not found");
    }

    return updatedAppointment;
  }

  private async bookAppointment(input: {
    business: Business;
    client: Client;
    serviceId: string;
    staffMemberId: string;
    startTime: string;
  }): Promise<Appointment> {
    const startsAt = parseAppointmentDate(input.startTime, "Appointment start time is required");

    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException("Appointment start time must be in the future");
    }

    const service = await this.loadActiveService(input.business.id, input.serviceId);
    const staffMember = await this.loadActiveStaffMember(input.business.id, input.staffMemberId);
    const endsAt = computeAppointmentEndTime(startsAt, service.durationMinutes);
    const date = getDateInTimeZone(startsAt, input.business.timezone);
    const businessHour = await this.getBusinessHourForDate(input.business.id, date, input.business.timezone);

    if (businessHour.isClosed || !businessHour.openTime || !businessHour.closeTime) {
      throw new BadRequestException("The business is closed on the selected date");
    }

    if (
      !isStartTimeWithinBusinessHours({
        closeTime: businessHour.closeTime,
        date,
        durationMinutes: service.durationMinutes,
        openTime: businessHour.openTime,
        startTime: startsAt,
        timeZone: input.business.timezone
      })
    ) {
      throw new BadRequestException("The selected time is outside business hours");
    }

    await this.assertSlotAvailable({
      businessId: input.business.id,
      date,
      endsAt,
      staffMemberId: staffMember.id,
      startsAt,
      timeZone: input.business.timezone
    });

    try {
      return await this.appointmentRepository.createAppointment({
        businessId: input.business.id,
        clientDisplayName: input.client.displayName,
        clientId: input.client.id,
        clientPhoneNumber: input.client.phoneNumber,
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
    } catch (error) {
      if (isPostgresExclusionViolation(error)) {
        throw new ConflictException("This appointment slot is no longer available");
      }

      throw error;
    }
  }

  private async computeAvailableSlots(
    business: Business,
    command: Omit<GetAvailableSlotsCommand, "requesterUserId">
  ): Promise<AvailableSlot[]> {
    const service = await this.loadActiveService(command.businessId, command.serviceId);
    await this.loadActiveStaffMember(command.businessId, command.staffMemberId);

    const businessHour = await this.getBusinessHourForDate(command.businessId, command.date, business.timezone);

    if (businessHour.isClosed || !businessHour.openTime || !businessHour.closeTime) {
      return [];
    }

    const dayStartUtc = zonedLocalToUtc(`${command.date}T00:00:00`, business.timezone);
    const dayEndUtc = zonedLocalToUtc(`${getNextDate(command.date)}T00:00:00`, business.timezone);
    const existingAppointments = await this.appointmentRepository.findAppointmentsForStaffMemberBetween(
      command.businessId,
      command.staffMemberId,
      dayStartUtc,
      dayEndUtc
    );

    return generateAvailableSlots({
      closeTime: businessHour.closeTime,
      date: command.date,
      durationMinutes: service.durationMinutes,
      existingAppointments,
      now: new Date(),
      openTime: businessHour.openTime,
      timeZone: business.timezone
    });
  }

  private async assertSlotAvailable(input: {
    businessId: string;
    date: string;
    endsAt: Date;
    staffMemberId: string;
    startsAt: Date;
    timeZone: string;
  }): Promise<void> {
    const dayStartUtc = zonedLocalToUtc(`${input.date}T00:00:00`, input.timeZone);
    const dayEndUtc = zonedLocalToUtc(`${getNextDate(input.date)}T00:00:00`, input.timeZone);
    const existingAppointments = await this.appointmentRepository.findAppointmentsForStaffMemberBetween(
      input.businessId,
      input.staffMemberId,
      dayStartUtc,
      dayEndUtc
    );
    const now = new Date();

    const hasOverlap = existingAppointments.some((appointment) => {
      if (!appointmentBlocksScheduling(appointment, now)) {
        return false;
      }

      return appointmentsOverlap(appointment.startsAt, appointment.endsAt, input.startsAt, input.endsAt);
    });

    if (hasOverlap) {
      throw new ConflictException("This appointment slot is no longer available");
    }
  }

  private async getBusinessHourForDate(businessId: string, date: string, timeZone: string) {
    const dayOfWeek = getDayOfWeekForDate(date, timeZone);
    const storedHours = await this.businessHoursRepository.findBusinessHours(businessId);
    // Businesses created before the business-hours feature have no rows;
    // fall back to defaults exactly like BusinessesService.getBusinessHours.
    const businessHours = storedHours.length > 0 ? storedHours : createDefaultBusinessHours(businessId);
    const businessHour = businessHours.find((hour) => hour.dayOfWeek === dayOfWeek);

    if (!businessHour) {
      throw new BadRequestException("Business hours are not configured for this business");
    }

    return businessHour;
  }

  private async loadActiveService(businessId: string, serviceId: string) {
    const service = await this.serviceRepository.findServiceByIdForBusiness(businessId, serviceId);

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    if (!service.active) {
      throw new BadRequestException("Service is not available");
    }

    return service;
  }

  private async loadActiveStaffMember(businessId: string, staffMemberId: string) {
    const staffMember = await this.staffRepository.findStaffMemberByIdForBusiness(businessId, staffMemberId);

    if (!staffMember) {
      throw new NotFoundException("Staff member not found");
    }

    if (!staffMember.active) {
      throw new BadRequestException("Staff member is not available");
    }

    return staffMember;
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

// Assembled from formatToParts because locale-dependent format() output
// (e.g. en-CA "YYYY-MM-DD") is not guaranteed across Node ICU builds.
function getDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });
  const values: Record<string, string> = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function getNextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));

  return nextDate.toISOString().slice(0, 10);
}

function isPostgresExclusionViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23P01";
}
