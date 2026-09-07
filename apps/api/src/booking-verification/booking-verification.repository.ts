export const BOOKING_VERIFICATION_REPOSITORY = Symbol("BOOKING_VERIFICATION_REPOSITORY");

export interface BookingPhoneVerification {
  attemptsRemaining: number;
  businessId: string;
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  normalizedPhone: string;
  updatedAt: Date;
  verifiedAt: Date | null;
}

export interface BookingPhoneVerificationSecret extends BookingPhoneVerification {
  codeHash: string;
}

export interface CreateBookingPhoneVerificationInput {
  attemptsRemaining: number;
  businessId: string;
  codeHash: string;
  cooldownSeconds: number;
  expiresAt: Date;
  id: string;
  normalizedPhone: string;
}

/** Thrown when a challenge already exists for the business + phone inside the cooldown window. */
export class BookingVerificationCooldownError extends Error {
  constructor() {
    super("Wait before requesting another verification code");
    this.name = "BookingVerificationCooldownError";
  }
}

export interface BookingVerificationRepository {
  /**
   * Atomically spends one guess against a usable challenge and returns the claimed row,
   * or `null` when the challenge is missing, expired, consumed, already verified, or out
   * of attempts. Callers must only compare the code against a successfully claimed row.
   */
  claimVerificationAttempt(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null>;
  findVerificationForBusiness(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null>;
  /**
   * Serializes issuance per business + phone, enforces the resend cooldown, inserts the
   * challenge, and calls `deliver` before committing. A `deliver` rejection rolls the
   * challenge back, so a failed send never consumes the cooldown.
   */
  issueVerification(
    input: CreateBookingPhoneVerificationInput,
    deliver: (verification: BookingPhoneVerification) => Promise<void>
  ): Promise<BookingPhoneVerification>;
  markVerificationVerified(verificationId: string): Promise<BookingPhoneVerification | null>;
}
