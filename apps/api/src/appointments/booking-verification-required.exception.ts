import { BadRequestException, HttpStatus } from "@nestjs/common";

/**
 * Machine-readable marker on the booking response body. The booking endpoint returns 400
 * for many unrelated reasons (past start time, closed business, inactive service), so
 * clients need this to tell "your challenge is unusable, request a new code" apart from
 * "fix your request and try again with the same challenge".
 */
export const BOOKING_VERIFICATION_INVALID_CODE = "booking_verification_invalid";

export class BookingVerificationRequiredException extends BadRequestException {
  constructor(message: string) {
    super({
      code: BOOKING_VERIFICATION_INVALID_CODE,
      error: "Bad Request",
      message,
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
}
