import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";

@Controller("businesses/:businessId/appointments")
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  createAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() body: CreateAppointmentDto
  ) {
    return this.appointmentsService.createAppointment({
      businessId,
      clientUserId: body.clientUserId,
      endsAt: body.endsAt,
      requesterUserId: user.id,
      serviceId: body.serviceId,
      staffMemberId: body.staffMemberId,
      startsAt: body.startsAt
    });
  }

  @Get()
  findAppointmentsForBusiness(@CurrentUser() user: AuthenticatedUser, @Param("businessId") businessId: string) {
    return this.appointmentsService.findAppointmentsForBusiness(businessId, user.id);
  }

  @Get(":appointmentId")
  getAppointmentDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("appointmentId") appointmentId: string
  ) {
    return this.appointmentsService.getAppointmentDetails(businessId, appointmentId, user.id);
  }

  @Post(":appointmentId/cancel")
  cancelAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("appointmentId") appointmentId: string
  ) {
    return this.appointmentsService.cancelAppointment(businessId, appointmentId, user.id);
  }

  @Post(":appointmentId/complete")
  completeAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("appointmentId") appointmentId: string
  ) {
    return this.appointmentsService.completeAppointment(businessId, appointmentId, user.id);
  }
}
