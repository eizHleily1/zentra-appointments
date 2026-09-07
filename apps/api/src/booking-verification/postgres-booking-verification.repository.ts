import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  BookingPhoneVerification,
  BookingPhoneVerificationSecret,
  BookingVerificationRepository,
  CreateBookingPhoneVerificationInput
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

  async createVerification(input: CreateBookingPhoneVerificationInput): Promise<BookingPhoneVerification> {
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
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

    return mapVerification(result.rows[0]);
  }

  async findLatestVerificationForPhone(
    businessId: string,
    normalizedPhone: string
  ): Promise<BookingPhoneVerification | null> {
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
      `
        SELECT *
        FROM booking_phone_verifications
        WHERE business_id = $1 AND normalized_phone = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [businessId, normalizedPhone]
    );

    return result.rows[0] ? mapVerification(result.rows[0]) : null;
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

  async markVerificationVerified(verificationId: string): Promise<BookingPhoneVerification | null> {
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
      `
        UPDATE booking_phone_verifications
        SET verified_at = COALESCE(verified_at, now()),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [verificationId]
    );

    return result.rows[0] ? mapVerification(result.rows[0]) : null;
  }

  async recordFailedAttempt(verificationId: string): Promise<BookingPhoneVerification | null> {
    const result = await this.databaseService.query<BookingPhoneVerificationRow>(
      `
        UPDATE booking_phone_verifications
        SET attempts_remaining = GREATEST(attempts_remaining - 1, 0),
            updated_at = now()
        WHERE id = $1
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
