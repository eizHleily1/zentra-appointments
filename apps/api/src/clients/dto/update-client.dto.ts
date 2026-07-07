import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Client name is required" })
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string | null;

  @IsOptional()
  @IsEmail(undefined, { message: "Enter a valid email address" })
  email?: string | null;
}
