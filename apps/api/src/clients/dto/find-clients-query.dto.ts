import { IsOptional, IsString, MaxLength } from "class-validator";

export class FindClientsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
