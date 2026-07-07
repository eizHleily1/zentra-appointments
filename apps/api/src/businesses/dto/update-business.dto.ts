import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { BUSINESS_TYPES, type BusinessType } from "../../tenants/business-type";

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: BusinessType;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;
}
