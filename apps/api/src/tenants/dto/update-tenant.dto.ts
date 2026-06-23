import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { BUSINESS_TYPES, type BusinessType } from "../business-type";

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: BusinessType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  timezone?: string;
}
