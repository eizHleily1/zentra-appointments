import type { Client } from "../clients/client.repository";
import type { Appointment, CreateAppointmentInput } from "./appointment.repository";

export const GUEST_BOOKING_REPOSITORY = Symbol("GUEST_BOOKING_REPOSITORY");

export interface GuestClientIdentity {
  businessId: string;
  /** Raw name as entered; `normalize_client_display_name` owns matching. */
  displayName: string;
  normalizedPhone: string;
  phoneNumber: string;
}

export type GuestAppointmentWrite = Omit<
  CreateAppointmentInput,
  "clientDisplayName" | "clientId" | "clientPhoneNumber"
>;

/**
 * Raised when the booking transaction cannot consume a verified challenge for this
 * business and phone number, whether it is missing, unverified, expired, or already
 * used by another booking.
 */
export class GuestBookingVerificationError extends Error {
  constructor() {
    super("Verify your phone number before booking");
    this.name = "GuestBookingVerificationError";
  }
}

export interface GuestBookingRepository {
  createGuestBooking(input: {
    appointment: GuestAppointmentWrite;
    guest: GuestClientIdentity;
    verificationId: string;
  }): Promise<{ appointment: Appointment; client: Client }>;
}
