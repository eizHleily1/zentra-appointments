import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Client } from "../src/clients/client.repository";
import type { Appointment } from "../src/appointments/appointment.repository";
import {
  GuestBookingVerificationError,
  type GuestAppointmentWrite,
  type GuestBookingRepository,
  type GuestClientIdentity
} from "../src/appointments/guest-booking.repository";
import { InMemoryAppointmentRepository } from "./in-memory-appointment.repository";
import { InMemoryBookingVerificationRepository } from "./in-memory-booking-verification.repository";
import { InMemoryClientRepository } from "./in-memory-client.repository";

export class InMemoryGuestBookingRepository implements GuestBookingRepository {
  constructor(
    private readonly clientRepository: InMemoryClientRepository,
    private readonly appointmentRepository: InMemoryAppointmentRepository,
    private readonly verificationRepository: InMemoryBookingVerificationRepository
  ) {}

  async createGuestBooking(input: {
    appointment: GuestAppointmentWrite;
    guest: GuestClientIdentity;
    verificationId: string;
  }): Promise<{ appointment: Appointment; client: Client }> {
    const consumed = this.verificationRepository.consumeVerifiedChallenge({
      businessId: input.guest.businessId,
      normalizedPhone: input.guest.normalizedPhone,
      verificationId: input.verificationId
    });

    if (!consumed) {
      throw new GuestBookingVerificationError();
    }

    let createdClientId: string | null = null;

    try {
      const client = await this.resolveGuestClient(input.guest);
      createdClientId = client.created ? client.record.id : null;
      const appointment = await this.appointmentRepository.createAppointment({
        ...input.appointment,
        clientDisplayName: client.record.displayName,
        clientId: client.record.id,
        clientPhoneNumber: client.record.phoneNumber
      });

      return { appointment, client: client.record };
    } catch (error) {
      // Compensating undo for the writes this call made, matching a transaction rollback.
      if (createdClientId) {
        this.clientRepository.removeClient(createdClientId);
      }

      this.verificationRepository.releaseConsumedChallenge(input.verificationId);

      throw error;
    }
  }

  private async resolveGuestClient(
    guest: GuestClientIdentity
  ): Promise<{ created: boolean; record: Client }> {
    // Anonymous booking may only ever reuse a client that is not linked to an account.
    const existing = await this.clientRepository.findActiveClientMatchingIdentity({
      businessId: guest.businessId,
      linkage: "unlinked",
      normalizedDisplayName: guest.normalizedDisplayName,
      normalizedPhone: guest.normalizedPhone
    });

    if (existing) {
      return { created: false, record: existing };
    }

    try {
      const record = await this.clientRepository.createClient({
        businessId: guest.businessId,
        displayName: guest.displayName,
        email: null,
        id: randomUUID(),
        linkedUserId: null,
        phoneNumber: guest.phoneNumber
      });

      return { created: true, record };
    } catch (error) {
      if (!isPostgresUniqueViolation(error)) {
        throw error;
      }

      const raced = await this.clientRepository.findActiveClientMatchingIdentity({
        businessId: guest.businessId,
        linkage: "unlinked",
        normalizedDisplayName: guest.normalizedDisplayName,
        normalizedPhone: guest.normalizedPhone
      });

      if (!raced) {
        throw new ConflictException("A client with this name and phone number already exists");
      }

      return { created: false, record: raced };
    }
  }
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
