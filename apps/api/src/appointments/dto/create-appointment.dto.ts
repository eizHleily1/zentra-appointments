import { IsISO8601, IsUUID } from "class-validator";

export class CreateAppointmentDto {
  @IsUUID()
  clientUserId!: string;

  @IsUUID()
  staffMemberId!: string;

  @IsUUID()
  serviceId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
