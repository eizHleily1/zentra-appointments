import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AppointmentsService } from "../appointments/appointments.service";
import { GetAvailableSlotsQueryDto } from "../appointments/dto/get-available-slots-query.dto";
import { CreateConsumerAppointmentDto } from "./dto/create-consumer-appointment.dto";
import { ListDiscoveryBusinessesQueryDto } from "./dto/list-discovery-businesses-query.dto";
import { DiscoveryService } from "./discovery.service";

@Controller("discovery")
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly appointmentsService: AppointmentsService
  ) {}

  @Get("businesses")
  listBusinesses(@Query() query: ListDiscoveryBusinessesQueryDto) {
    return this.discoveryService.listBusinesses(query.category, query.search);
  }

  @Get("businesses/:businessId")
  getBusinessProfile(@Param("businessId") businessId: string) {
    return this.discoveryService.getBusinessProfile(businessId);
  }

  @Get("businesses/:businessId/available-slots")
  @UseGuards(JwtAuthGuard)
  getAvailableSlots(
    @Param("businessId") businessId: string,
    @Query() query: GetAvailableSlotsQueryDto
  ) {
    return this.appointmentsService.getConsumerAvailableSlots({
      businessId,
      date: query.date,
      serviceId: query.serviceId,
      staffMemberId: query.staffMemberId
    });
  }

  @Post("businesses/:businessId/appointments")
  @UseGuards(JwtAuthGuard)
  createAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() body: CreateConsumerAppointmentDto
  ) {
    return this.appointmentsService.createConsumerAppointment({
      businessId,
      requesterEmail: user.email,
      requesterUserId: user.id,
      serviceId: body.serviceId,
      staffMemberId: body.staffMemberId,
      startTime: body.startTime
    });
  }
}
