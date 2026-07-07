import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";

export class BusinessHourEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  isClosed!: boolean;

  @ValidateIf((entry: BusinessHourEntryDto) => !entry.isClosed)
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  openTime?: string;

  @ValidateIf((entry: BusinessHourEntryDto) => !entry.isClosed)
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime?: string;
}

export class UpdateBusinessHoursDto {
  @IsArray()
  @ArrayMinSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourEntryDto)
  hours!: BusinessHourEntryDto[];
}
