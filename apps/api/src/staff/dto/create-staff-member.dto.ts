import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateStaffMemberDto {
  @IsOptional()
  @IsUUID(undefined, { message: "Staff user ID must be a valid ID" })
  userId?: string;

  @IsOptional()
  @IsEmail(undefined, { message: "Staff email must be a valid email address" })
  userEmail?: string;

  @IsString()
  @MinLength(1, { message: "Staff display name is required" })
  displayName!: string;
}
