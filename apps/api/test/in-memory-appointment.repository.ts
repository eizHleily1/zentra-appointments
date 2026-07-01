import type { AppointmentStatus } from "../src/appointments/appointment-status";
import type {
  Appointment,
  AppointmentRepository,
  CreateAppointmentInput
} from "../src/appointments/appointment.repository";

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly appointments = new Map<string, Appointment>();

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const now = new Date();
    const appointment: Appointment = {
      businessId: input.businessId,
      clientUserId: input.clientUserId,
      createdAt: now,
      endsAt: input.endsAt,
      id: input.id,
      serviceDurationMinutes: input.serviceDurationMinutes,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      servicePrice: input.servicePrice,
      staffDisplayName: input.staffDisplayName,
      staffMemberId: input.staffMemberId,
      startsAt: input.startsAt,
      status: "BOOKED",
      updatedAt: now
    };

    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async findAppointmentsForBusiness(businessId: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter((appointment) => appointment.businessId === businessId);
  }

  async findAppointmentByIdForBusiness(businessId: string, appointmentId: string): Promise<Appointment | null> {
    const appointment = this.appointments.get(appointmentId);

    if (!appointment || appointment.businessId !== businessId) {
      return null;
    }

    return appointment;
  }

  async updateAppointmentStatus(
    businessId: string,
    appointmentId: string,
    status: AppointmentStatus
  ): Promise<Appointment | null> {
    const appointment = await this.findAppointmentByIdForBusiness(businessId, appointmentId);

    if (!appointment) {
      return null;
    }

    const updatedAppointment: Appointment = {
      ...appointment,
      status,
      updatedAt: new Date()
    };

    this.appointments.set(appointmentId, updatedAppointment);
    return updatedAppointment;
  }

  getAppointments(): Appointment[] {
    return Array.from(this.appointments.values());
  }
}
