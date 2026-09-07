import { IsISO8601, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateConsumerAppointmentDto {
  @IsUUID(undefined, { message: "Select a staff member" })
  staffMemberId!: string;

  @IsUUID(undefined, { message: "Select a service" })
  serviceId!: string;

  @IsISO8601(undefined, { message: "Select an available time slot" })
  startTime!: string;

  @IsString()
  @MinLength(1, { message: "Enter your name" })
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(1, { message: "Enter a phone number" })
  @MaxLength(40)
  phoneNumber!: string;

  // Deliberately worded differently from BookingVerificationRequiredException. That
  // exception is the only source of code "booking_verification_invalid", and a malformed
  // payload is a client bug rather than an unusable challenge.
  @IsUUID(undefined, { message: "A verified phone number is required to book" })
  verificationId!: string;
}
