import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AppointmentsService } from "../appointments/appointments.service";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("appointments")
  getMyAppointments(@CurrentUser() user: AuthenticatedUser) {
    return this.appointmentsService.findAppointmentsForLinkedUser(user.id);
  }
}
