import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { FindClientsQueryDto } from "./dto/find-clients-query.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Controller("businesses/:businessId/clients")
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  createClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() body: CreateClientDto
  ) {
    return this.clientsService.createClient({
      businessId,
      displayName: body.displayName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      requesterUserId: user.id
    });
  }

  @Get()
  findClientsForBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Query() query: FindClientsQueryDto
  ) {
    return this.clientsService.findClientsForBusiness(businessId, user.id, query.search);
  }

  @Get(":clientId")
  getClientDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("clientId") clientId: string
  ) {
    return this.clientsService.getClientDetails(businessId, clientId, user.id);
  }

  @Patch(":clientId")
  updateClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("clientId") clientId: string,
    @Body() body: UpdateClientDto
  ) {
    return this.clientsService.updateClient({
      businessId,
      clientId,
      displayName: body.displayName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      requesterUserId: user.id
    });
  }

  @Post(":clientId/deactivate")
  deactivateClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("clientId") clientId: string
  ) {
    return this.clientsService.deactivateClient(businessId, clientId, user.id);
  }
}
