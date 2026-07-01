import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { ServicesService } from "./services.service";

@Controller("businesses/:businessId/services")
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  createService(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() body: CreateServiceDto
  ) {
    return this.servicesService.createService({
      businessId,
      description: body.description,
      durationMinutes: body.durationMinutes,
      name: body.name,
      price: body.price,
      userId: user.id
    });
  }

  @Get()
  findServicesForBusiness(@CurrentUser() user: AuthenticatedUser, @Param("businessId") businessId: string) {
    return this.servicesService.findServicesForBusiness(businessId, user.id);
  }

  @Get(":serviceId")
  getServiceDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.servicesService.getServiceDetails(businessId, serviceId, user.id);
  }

  @Patch(":serviceId")
  updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("serviceId") serviceId: string,
    @Body() body: UpdateServiceDto
  ) {
    return this.servicesService.updateService({
      businessId,
      description: body.description,
      durationMinutes: body.durationMinutes,
      name: body.name,
      price: body.price,
      serviceId,
      userId: user.id
    });
  }

  @Post(":serviceId/deactivate")
  deactivateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.servicesService.deactivateService(businessId, serviceId, user.id);
  }
}
