import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import {
  BookingVerificationCooldownError,
  type BookingPhoneVerification,
  type BookingPhoneVerificationSecret,
  type BookingVerificationRepository,
  type CreateBookingPhoneVerificationInput
} from "./booking-verification.repository";

interface BookingPhoneVerificationRow {
  attempts_remaining: number;
  business_id: string;
  code_hash: string;
  consumed_at: Date | null;
  created_at: Date;
  expires_at: Date;
  id: string;
  normalized_phone: string;
  updated_at: Date;
  verified_at: Date | null;
}

@Injectable()
export class PostgresBookingVerificationRepository implements BookingVerificationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async claimVerificationAttempt(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null> {
    // A single conditional UPDATE is the whole claim. Concurrent statements queue on the
    // row lock and re-evaluate the WHERE clause against the committed row, so the last
    // remaining attempt can only be won once.
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
      `
        UPDATE booking_phone_verifications
        SET attempts_remaining = attempts_remaining - 1,
            updated_at = now()
        WHERE id = $2
          AND business_id = $1
          AND consumed_at IS NULL
          AND verified_at IS NULL
          AND expires_at > now()
          AND attempts_remaining > 0
        RETURNING *
      `,
      [businessId, verificationId]
    );

    return result.rows[0] ? mapVerificationSecret(result.rows[0]) : null;
  }

  async findVerificationForBusiness(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null> {
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
      "SELECT * FROM booking_phone_verifications WHERE business_id = $1 AND id = $2 LIMIT 1",
      [businessId, verificationId]
    );

    return result.rows[0] ? mapVerificationSecret(result.rows[0]) : null;
  }

  async issueVerification(
    input: CreateBookingPhoneVerificationInput,
    deliver: (verification: BookingPhoneVerification) => Promise<void>
  ): Promise<BookingPhoneVerification> {
    return this.databaseService.transaction(async (tx) => {
      // Held until commit or rollback, so the cooldown read, the insert, and the send are
      // serialized against every other request for the same business + phone.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
        input.businessId,
        input.normalizedPhone
      ]);

      if (input.cooldownSeconds > 0) {
        const recent = await tx.query<{ id: string }>(
          `
            SELECT id
            FROM booking_phone_verifications
            WHERE business_id = $1
              AND normalized_phone = $2
              AND created_at > now() - make_interval(secs => $3::int)
            LIMIT 1
          `,
          [input.businessId, input.normalizedPhone, input.cooldownSeconds]
        );

        if (recent.rows.length > 0) {
          throw new BookingVerificationCooldownError();
        }
      }

      const inserted = await tx.query<BookingPhoneVerificationRow>(
        `
          INSERT INTO booking_phone_verifications (
            id,
            business_id,
            normalized_phone,
            code_hash,
            expires_at,
            attempts_remaining
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [input.id, input.businessId, input.normalizedPhone, input.codeHash, input.expiresAt, input.attemptsRemaining]
      );

      const verification = mapVerification(inserted.rows[0]);
      await deliver(verification);

      return verification;
    });
  }

  async markVerificationVerified(verificationId: string): Promise<BookingPhoneVerification | null> {
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
      `
        UPDATE booking_phone_verifications
        SET verified_at = COALESCE(verified_at, now()),
            updated_at = now()
        WHERE id = $1
          AND consumed_at IS NULL
          AND expires_at > now()
        RETURNING *
      `,
      [verificationId]
    );

    return result.rows[0] ? mapVerification(result.rows[0]) : null;
  }
}

function mapVerification(row: BookingPhoneVerificationRow): BookingPhoneVerification {
  return {
    attemptsRemaining: row.attempts_remaining,
    businessId: row.business_id,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    normalizedPhone: row.normalized_phone,
    updatedAt: row.updated_at,
    verifiedAt: row.verified_at
  };
}

function mapVerificationSecret(row: BookingPhoneVerificationRow): BookingPhoneVerificationSecret {
  return {
    ...mapVerification(row),
    codeHash: row.code_hash
  };
}
