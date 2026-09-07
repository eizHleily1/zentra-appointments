import { IsString, IsUUID, Matches } from "class-validator";

export class VerifyBookingVerificationDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: "Enter the 6-digit verification code" })
  code!: string;

  // Kept out of the URL so the challenge never lands in access logs or APM URL fields.
  @IsUUID()
  verificationId!: string;
}
