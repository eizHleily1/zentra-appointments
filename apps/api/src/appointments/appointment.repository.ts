import type { AppointmentStatus } from "./appointment-status";

export const APPOINTMENT_REPOSITORY = Symbol("APPOINTMENT_REPOSITORY");

export interface Appointment {
  businessId: string;
  clientUserId: string;
  createdAt: Date;
  endsAt: Date;
  id: string;
  serviceDurationMinutes: number;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  staffDisplayName: string;
  staffMemberId: string;
  startsAt: Date;
  status: AppointmentStatus;
  updatedAt: Date;
}

export interface CreateAppointmentInput {
  businessId: string;
  clientUserId: string;
  endsAt: Date;
  id: string;
  serviceDurationMinutes: number;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  staffDisplayName: string;
  staffMemberId: string;
  startsAt: Date;
}

export interface AppointmentRepository {
  createAppointment(input: CreateAppointmentInput): Promise<Appointment>;
  findAppointmentByIdForBusiness(businessId: string, appointmentId: string): Promise<Appointment | null>;
  findAppointmentsForBusiness(businessId: string): Promise<Appointment[]>;
  updateAppointmentStatus(
    businessId: string,
    appointmentId: string,
    status: AppointmentStatus
  ): Promise<Appointment | null>;
}
