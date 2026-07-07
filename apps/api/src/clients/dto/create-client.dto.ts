import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateClientDto {
  @IsString()
  @MinLength(1, { message: "Client name is required" })
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsEmail(undefined, { message: "Enter a valid email address" })
  email?: string;
}
