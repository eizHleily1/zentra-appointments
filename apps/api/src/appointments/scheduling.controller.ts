import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AppointmentsService } from "./appointments.service";
import { GetAvailableSlotsQueryDto } from "./dto/get-available-slots-query.dto";

@Controller("businesses/:businessId")
@UseGuards(JwtAuthGuard)
export class SchedulingController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("available-slots")
  getAvailableSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Query() query: GetAvailableSlotsQueryDto
  ) {
    return this.appointmentsService.getAvailableSlots({
      businessId,
      date: query.date,
      requesterUserId: user.id,
      serviceId: query.serviceId,
      staffMemberId: query.staffMemberId
    });
  }
}
