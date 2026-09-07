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

  @IsUUID(undefined, { message: "Verify your phone number before booking" })
  verificationId!: string;
}
