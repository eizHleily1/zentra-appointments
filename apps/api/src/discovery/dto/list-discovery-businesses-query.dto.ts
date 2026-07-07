import { IsIn, IsOptional, IsString } from "class-validator";
import { DISCOVERY_CATEGORIES, type DiscoveryCategory } from "../discovery-category";

export class ListDiscoveryBusinessesQueryDto {
  @IsOptional()
  @IsIn(DISCOVERY_CATEGORIES)
  category?: DiscoveryCategory;

  @IsOptional()
  @IsString()
  search?: string;
}
