import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateIf } from "class-validator";

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(0)
  price?: number | null;
}
