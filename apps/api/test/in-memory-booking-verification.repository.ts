import {
  BookingVerificationCooldownError,
  type BookingPhoneVerification,
  type BookingPhoneVerificationSecret,
  type BookingVerificationRepository,
  type CreateBookingPhoneVerificationInput
} from "../src/booking-verification/booking-verification.repository";

export class InMemoryBookingVerificationRepository implements BookingVerificationRepository {
  private readonly verifications = new Map<string, BookingPhoneVerificationSecret>();

  /** Mirrors the conditional UPDATE that spends one attempt in Postgres. */
  async claimVerificationAttempt(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null> {
    const verification = this.verifications.get(verificationId);

    if (
      !verification ||
      verification.businessId !== businessId ||
      verification.consumedAt !== null ||
      verification.verifiedAt !== null ||
      verification.expiresAt.getTime() <= Date.now() ||
      verification.attemptsRemaining <= 0
    ) {
      return null;
    }

    verification.attemptsRemaining -= 1;
    verification.updatedAt = new Date();
    return { ...verification };
  }

  async issueVerification(
    input: CreateBookingPhoneVerificationInput,
    deliver: (verification: BookingPhoneVerification) => Promise<void>
  ): Promise<BookingPhoneVerification> {
    // The cooldown read and the insert happen before the first await, which gives the
    // same "only one issuance wins" guarantee the advisory lock gives in Postgres.
    if (input.cooldownSeconds > 0) {
      const cutoff = Date.now() - input.cooldownSeconds * 1000;
      const recent = Array.from(this.verifications.values()).some(
        (verification) =>
          verification.businessId === input.businessId &&
          verification.normalizedPhone === input.normalizedPhone &&
          verification.createdAt.getTime() > cutoff
      );

      if (recent) {
        throw new BookingVerificationCooldownError();
      }
    }

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

    try {
      await deliver(stripCodeHash(verification));
    } catch (error) {
      this.verifications.delete(verification.id);
      throw error;
    }

    return stripCodeHash(verification);
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

    if (!verification || verification.consumedAt !== null || verification.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    verification.verifiedAt = verification.verifiedAt ?? new Date();
    verification.updatedAt = new Date();
    return stripCodeHash(verification);
  }

  /** Seeds a challenge directly, bypassing cooldown and delivery. */
  seedVerification(
    input: Omit<CreateBookingPhoneVerificationInput, "cooldownSeconds">
  ): BookingPhoneVerificationSecret {
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
    return { ...verification };
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
