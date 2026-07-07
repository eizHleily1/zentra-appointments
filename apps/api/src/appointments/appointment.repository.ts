import type { AppointmentStatus } from "./appointment-status";

export const APPOINTMENT_REPOSITORY = Symbol("APPOINTMENT_REPOSITORY");

export interface Appointment {
  businessId: string;
  clientDisplayName: string;
  clientId: string;
  clientPhoneNumber: string | null;
  createdAt: Date;
  endsAt: Date;
  id: string;
  serviceDurationMinutes: number;
  serviceId: string;
  serviceName: string;
  servicePrice: number | null;
  staffDisplayName: string;
  staffMemberId: string;
  startsAt: Date;
  status: AppointmentStatus;
  updatedAt: Date;
}

export interface ConsumerAppointment extends Appointment {
  businessName: string;
  businessTimezone: string;
}

export interface CreateAppointmentInput {
  businessId: string;
  clientDisplayName: string;
  clientId: string;
  clientPhoneNumber: string | null;
  endsAt: Date;
  id: string;
  serviceDurationMinutes: number;
  serviceId: string;
  serviceName: string;
  servicePrice: number | null;
  staffDisplayName: string;
  staffMemberId: string;
  startsAt: Date;
}

export interface AppointmentRepository {
  createAppointment(input: CreateAppointmentInput): Promise<Appointment>;
  findAppointmentByIdForBusiness(businessId: string, appointmentId: string): Promise<Appointment | null>;
  findAppointmentsForBusiness(businessId: string): Promise<Appointment[]>;
  findAppointmentsForStaffMemberBetween(
    businessId: string,
    staffMemberId: string,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<Appointment[]>;
  updateAppointmentStatus(
    businessId: string,
    appointmentId: string,
    status: AppointmentStatus
  ): Promise<Appointment | null>;
}
