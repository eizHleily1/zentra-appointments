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
  expiresAt: Date;
  id: string;
  normalizedPhone: string;
}

export interface BookingVerificationRepository {
  createVerification(input: CreateBookingPhoneVerificationInput): Promise<BookingPhoneVerification>;
  findLatestVerificationForPhone(
    businessId: string,
    normalizedPhone: string
  ): Promise<BookingPhoneVerification | null>;
  findVerificationForBusiness(
    businessId: string,
    verificationId: string
  ): Promise<BookingPhoneVerificationSecret | null>;
  markVerificationVerified(verificationId: string): Promise<BookingPhoneVerification | null>;
  recordFailedAttempt(verificationId: string): Promise<BookingPhoneVerification | null>;
}
