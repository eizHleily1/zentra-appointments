import { IsString, MaxLength, MinLength } from "class-validator";

export class RequestBookingVerificationDto {
  @IsString()
  @MinLength(1, { message: "Enter a phone number" })
  @MaxLength(40)
  phoneNumber!: string;
}
