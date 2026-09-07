import type {
  BookingPhoneVerification,
  BookingPhoneVerificationSecret,
  BookingVerificationRepository,
  CreateBookingPhoneVerificationInput
} from "../src/booking-verification/booking-verification.repository";

export class InMemoryBookingVerificationRepository implements BookingVerificationRepository {
  private readonly verifications = new Map<string, BookingPhoneVerificationSecret>();

  async createVerification(input: CreateBookingPhoneVerificationInput): Promise<BookingPhoneVerification> {
    const now = new Date();
    const verification: BookingPhoneVerificationSecret = {
      attemptsRemaining: input.attemptsRemaining,
      businessId: input.businessId,
      codeHash: input.codeHash,
      consumedAt: null,
      createdAt: now,
      expiresAt: input.expiresAt,
      id: input.id,
      normalizedPhone: input.normalizedPhone,
      updatedAt: now,
      verifiedAt: null
    };

    this.verifications.set(verification.id, verification);
    return stripCodeHash(verification);
  }

  async findLatestVerificationForPhone(
    businessId: string,
    normalizedPhone: string
  ): Promise<BookingPhoneVerification | null> {
    const matches = Array.from(this.verifications.values())
      .filter(
        (verification) =>
          verification.businessId === businessId && verification.normalizedPhone === normalizedPhone
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return matches[0] ? stripCodeHash(matches[0]) : null;
  }

  async findVerificationForBusiness(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null> {
    const verification = this.verifications.get(verificationId);

    if (!verification || verification.businessId !== businessId) {
      return null;
    }

    return { ...verification };
  }

  async markVerificationVerified(verificationId: string): Promise<BookingPhoneVerification | null> {
    const verification = this.verifications.get(verificationId);

    if (!verification) {
      return null;
    }

    verification.verifiedAt = verification.verifiedAt ?? new Date();
    verification.updatedAt = new Date();
    return stripCodeHash(verification);
  }

  async recordFailedAttempt(verificationId: string): Promise<BookingPhoneVerification | null> {
    const verification = this.verifications.get(verificationId);

    if (!verification) {
      return null;
    }

    verification.attemptsRemaining = Math.max(verification.attemptsRemaining - 1, 0);
    verification.updatedAt = new Date();
    return stripCodeHash(verification);
  }

  /** Mirrors the conditional UPDATE the Postgres booking transaction runs. */
  consumeVerifiedChallenge(input: {
    businessId: string;
    normalizedPhone: string;
    verificationId: string;
  }): boolean {
    const verification = this.verifications.get(input.verificationId);

    if (
      !verification ||
      verification.businessId !== input.businessId ||
      verification.normalizedPhone !== input.normalizedPhone ||
      verification.verifiedAt === null ||
      verification.consumedAt !== null ||
      verification.expiresAt.getTime() <= Date.now()
    ) {
      return false;
    }

    verification.consumedAt = new Date();
    verification.updatedAt = new Date();
    return true;
  }

  /** Undoes a consume when the surrounding booking write fails, like a transaction rollback. */
  releaseConsumedChallenge(verificationId: string): void {
    const verification = this.verifications.get(verificationId);

    if (verification) {
      verification.consumedAt = null;
    }
  }

  expireVerification(verificationId: string): void {
    const verification = this.verifications.get(verificationId);

    if (verification) {
      verification.expiresAt = new Date(Date.now() - 1000);
    }
  }

  getVerifications(): BookingPhoneVerificationSecret[] {
    return Array.from(this.verifications.values()).map((verification) => ({ ...verification }));
  }
}

function stripCodeHash(verification: BookingPhoneVerificationSecret): BookingPhoneVerification {
  return {
    attemptsRemaining: verification.attemptsRemaining,
    businessId: verification.businessId,
    consumedAt: verification.consumedAt,
    createdAt: verification.createdAt,
    expiresAt: verification.expiresAt,
    id: verification.id,
    normalizedPhone: verification.normalizedPhone,
    updatedAt: verification.updatedAt,
    verifiedAt: verification.verifiedAt
  };
}
