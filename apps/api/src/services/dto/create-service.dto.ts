import { IsInt, IsNumber, IsString, Min, MinLength } from "class-validator";

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsNumber()
  @Min(0)
  price!: number;
}
