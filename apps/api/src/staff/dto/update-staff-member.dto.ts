import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateStaffMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;
}
