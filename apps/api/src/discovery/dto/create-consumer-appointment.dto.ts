import { IsISO8601, IsUUID } from "class-validator";

export class CreateConsumerAppointmentDto {
  @IsUUID(undefined, { message: "Select a staff member" })
  staffMemberId!: string;

  @IsUUID(undefined, { message: "Select a service" })
  serviceId!: string;

  @IsISO8601(undefined, { message: "Select an available time slot" })
  startTime!: string;
}
