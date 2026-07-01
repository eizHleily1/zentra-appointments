import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { BusinessesService } from "./businesses.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@Controller("businesses")
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  createBusiness(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBusinessDto) {
    return this.businessesService.createBusiness({
      businessType: body.businessType,
      name: body.name,
      ownerUserId: user.id,
      timezone: body.timezone
    });
  }

  @Get()
  findMyBusinesses(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.findMyBusinesses(user.id);
  }

  @Get(":businessId")
  getBusinessDetails(@CurrentUser() user: AuthenticatedUser, @Param("businessId") businessId: string) {
    return this.businessesService.getBusinessDetails(businessId, user.id);
  }

  @Patch(":businessId")
  updateBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() body: UpdateBusinessDto
  ) {
    return this.businessesService.updateBusiness({
      businessId,
      businessType: body.businessType,
      name: body.name,
      requesterUserId: user.id,
      timezone: body.timezone
    });
  }

  @Post(":businessId/deactivate")
  deactivateBusiness(@CurrentUser() user: AuthenticatedUser, @Param("businessId") businessId: string) {
    return this.businessesService.deactivateBusiness(businessId, user.id);
  }
}
