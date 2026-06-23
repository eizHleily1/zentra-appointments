import { IsIn, IsString, MinLength } from "class-validator";
import { BUSINESS_TYPES, type BusinessType } from "../business-type";

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(BUSINESS_TYPES)
  businessType!: BusinessType;

  @IsString()
  @MinLength(1)
  timezone!: string;
}
