import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Client } from "../clients/client.repository";
import { DatabaseService, type DatabaseTransactionClient } from "../database/database.service";
import type { AppointmentStatus } from "./appointment-status";
import type { Appointment } from "./appointment.repository";
import {
  GuestBookingVerificationError,
  type GuestAppointmentWrite,
  type GuestBookingRepository,
  type GuestClientIdentity
} from "./guest-booking.repository";

interface ClientRow {
  active: boolean;
  business_id: string;
  created_at: Date;
  display_name: string;
  email: string | null;
  id: string;
  linked_user_id: string | null;
  phone_number: string | null;
  updated_at: Date;
}

interface AppointmentRow {
  business_id: string;
  client_display_name: string;
  client_id: string;
  client_phone_number: string | null;
  created_at: Date;
  ends_at: Date;
  id: string;
  service_duration_minutes: number;
  service_id: string;
  service_name: string;
  service_price: string | null;
  staff_display_name: string;
  staff_member_id: string;
  starts_at: Date;
  status: AppointmentStatus;
  updated_at: Date;
}

@Injectable()
export class PostgresGuestBookingRepository implements GuestBookingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  createGuestBooking(input: {
    appointment: GuestAppointmentWrite;
    guest: GuestClientIdentity;
    verificationId: string;
  }): Promise<{ appointment: Appointment; client: Client }> {
    return this.databaseService.transaction(async (tx) => {
      await consumeVerificationInTransaction(tx, {
        businessId: input.guest.businessId,
        normalizedPhone: input.guest.normalizedPhone,
        verificationId: input.verificationId
      });

      const client = await resolveGuestClientInTransaction(tx, input.guest);
      const appointment = await insertAppointment(tx, {
        ...input.appointment,
        clientDisplayName: client.displayName,
        clientId: client.id,
        clientPhoneNumber: client.phoneNumber
      });

      return { appointment, client };
    });
  }
}

/**
 * Marks the verified challenge as used. The conditional UPDATE takes a row lock, so a
 * second concurrent booking blocks here and then matches zero rows once the winner
 * commits. Because the update lives in the booking transaction, a later failure such
 * as a slot conflict rolls `consumed_at` back and the guest can retry the same code.
 */
async function consumeVerificationInTransaction(
  tx: DatabaseTransactionClient,
  input: { businessId: string; normalizedPhone: string; verificationId: string }
): Promise<void> {
  const result = await tx.query(
    `
      UPDATE booking_phone_verifications
      SET consumed_at = now(),
          updated_at = now()
      WHERE id = $1
        AND business_id = $2
        AND normalized_phone = $3
        AND verified_at IS NOT NULL
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING id
    `,
    [input.verificationId, input.businessId, input.normalizedPhone]
  );

  if (result.rows.length === 0) {
    throw new GuestBookingVerificationError();
  }
}

async function resolveGuestClientInTransaction(
  tx: DatabaseTransactionClient,
  guest: GuestClientIdentity
): Promise<Client> {
  const existing = await findGuestClient(tx, guest);

  if (existing) {
    return existing;
  }

  const inserted = await tx.query<ClientRow>(
    `
      INSERT INTO clients (
        id,
        business_id,
        display_name,
        phone_number,
        email,
        linked_user_id,
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [randomUUID(), guest.businessId, guest.displayName, guest.phoneNumber, null, null]
  );

  if (inserted.rows[0]) {
    return mapClient(inserted.rows[0]);
  }

  const raced = await findGuestClient(tx, guest);

  if (!raced) {
    throw new Error("Guest client identity was not found after a concurrent insert");
  }

  return raced;
}

async function findGuestClient(tx: DatabaseTransactionClient, guest: GuestClientIdentity): Promise<Client | null> {
  const result = await tx.query<ClientRow>(
    `
      SELECT *
      FROM clients
      WHERE business_id = $1
        AND active = true
        AND linked_user_id IS NULL
        AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $2
        AND lower(btrim(display_name)) = $3
      LIMIT 1
    `,
    [guest.businessId, guest.normalizedPhone, guest.normalizedDisplayName]
  );

  return result.rows[0] ? mapClient(result.rows[0]) : null;
}

async function insertAppointment(
  tx: DatabaseTransactionClient,
  input: GuestAppointmentWrite & {
    clientDisplayName: string;
    clientId: string;
    clientPhoneNumber: string | null;
  }
): Promise<Appointment> {
  const result = await tx.query<AppointmentRow>(
    `
      INSERT INTO appointments (
        id,
        business_id,
        client_id,
        client_display_name,
        client_phone_number,
        staff_member_id,
        service_id,
        starts_at,
        ends_at,
        status,
        service_name,
        service_duration_minutes,
        service_price,
        staff_display_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'BOOKED', $10, $11, $12, $13)
      RETURNING *
    `,
    [
      input.id,
      input.businessId,
      input.clientId,
      input.clientDisplayName,
      input.clientPhoneNumber,
      input.staffMemberId,
      input.serviceId,
      input.startsAt,
      input.endsAt,
      input.serviceName,
      input.serviceDurationMinutes,
      input.servicePrice,
      input.staffDisplayName
    ]
  );

  return mapAppointment(result.rows[0]);
}

function mapClient(row: ClientRow): Client {
  return {
    active: row.active,
    businessId: row.business_id,
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
    id: row.id,
    linkedUserId: row.linked_user_id,
    phoneNumber: row.phone_number,
    updatedAt: row.updated_at
  };
}

function mapAppointment(row: AppointmentRow): Appointment {
  return {
    businessId: row.business_id,
    clientDisplayName: row.client_display_name,
    clientId: row.client_id,
    clientPhoneNumber: row.client_phone_number,
    createdAt: row.created_at,
    endsAt: row.ends_at,
    id: row.id,
    serviceDurationMinutes: row.service_duration_minutes,
    serviceId: row.service_id,
    serviceName: row.service_name,
    servicePrice: row.service_price === null ? null : Number(row.service_price),
    staffDisplayName: row.staff_display_name,
    staffMemberId: row.staff_member_id,
    startsAt: row.starts_at,
    status: row.status,
    updatedAt: row.updated_at
  };
}

