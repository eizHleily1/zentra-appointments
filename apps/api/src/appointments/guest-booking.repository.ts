import type { Client } from "../clients/client.repository";
import type { Appointment, CreateAppointmentInput } from "./appointment.repository";

export const GUEST_BOOKING_REPOSITORY = Symbol("GUEST_BOOKING_REPOSITORY");

export interface GuestClientIdentity {
  businessId: string;
  displayName: string;
  normalizedDisplayName: string;
  normalizedPhone: string;
  phoneNumber: string;
}

export type GuestAppointmentWrite = Omit<
  CreateAppointmentInput,
  "clientDisplayName" | "clientId" | "clientPhoneNumber"
>;

export interface GuestBookingRepository {
  createGuestBooking(input: {
    appointment: GuestAppointmentWrite;
    guest: GuestClientIdentity;
  }): Promise<{ appointment: Appointment; client: Client }>;
}
