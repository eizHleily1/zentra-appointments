import { IsString, IsUUID, Matches } from "class-validator";

export class GetAvailableSlotsQueryDto {
  @IsUUID(undefined, { message: "Select a service" })
  serviceId!: string;

  @IsUUID(undefined, { message: "Select a staff member" })
  staffMemberId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must use the YYYY-MM-DD format" })
  date!: string;
}
