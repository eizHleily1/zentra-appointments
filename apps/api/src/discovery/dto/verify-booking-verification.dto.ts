import { IsString, Matches } from "class-validator";

export class VerifyBookingVerificationDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: "Enter the 6-digit verification code" })
  code!: string;
}
