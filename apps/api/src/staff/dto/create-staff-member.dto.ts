import { IsString, IsUUID, MinLength } from "class-validator";

export class CreateStaffMemberDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;
}
