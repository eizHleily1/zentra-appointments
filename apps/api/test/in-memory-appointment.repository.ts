import type { AppointmentStatus } from "../src/appointments/appointment-status";

import type { Appointment, AppointmentRepository, ClientAppointmentSummary, CreateAppointmentInput } from "../src/appointments/appointment.repository";

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly appointments = new Map<string, Appointment>();

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const now = new Date();
    const appointment: Appointment = {
      businessId: input.businessId,
      clientDisplayName: input.clientDisplayName,
      clientId: input.clientId,
      clientPhoneNumber: input.clientPhoneNumber,
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

  async findAppointmentsForClient(businessId: string, clientId: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter((appointment) => appointment.businessId === businessId && appointment.clientId === clientId)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  }

  async findAppointmentSummariesForBusiness(businessId: string): Promise<ClientAppointmentSummary[]> {
    const summaries = new Map<string, ClientAppointmentSummary>();

    for (const appointment of this.appointments.values()) {
      if (appointment.businessId !== businessId) {
        continue;
      }

      const existing = summaries.get(appointment.clientId);

      if (!existing) {
        summaries.set(appointment.clientId, {
          clientId: appointment.clientId,
          lastAppointmentAt: appointment.startsAt,
          totalAppointments: 1
        });
        continue;
      }

      summaries.set(appointment.clientId, {
        clientId: appointment.clientId,
        lastAppointmentAt:
          !existing.lastAppointmentAt || appointment.startsAt.getTime() > existing.lastAppointmentAt.getTime()
            ? appointment.startsAt
            : existing.lastAppointmentAt,
        totalAppointments: existing.totalAppointments + 1
      });
    }

    return Array.from(summaries.values());
  }

  async findAppointmentsForStaffMemberBetween(
    businessId: string,
    staffMemberId: string,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      (appointment) =>
        appointment.businessId === businessId &&
        appointment.staffMemberId === staffMemberId &&
        appointment.startsAt.getTime() >= rangeStart.getTime() &&
        appointment.startsAt.getTime() < rangeEnd.getTime()
    );
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
