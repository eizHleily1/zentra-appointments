import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateStaffMemberDto } from "./dto/create-staff-member.dto";
import { UpdateStaffMemberDto } from "./dto/update-staff-member.dto";
import { StaffService } from "./staff.service";

@Controller("businesses/:businessId/staff")
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  createStaffMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() body: CreateStaffMemberDto
  ) {
    return this.staffService.createStaffMember({
      businessId,
      displayName: body.displayName,
      requesterUserId: user.id,
      userEmail: body.userEmail,
      userId: body.userId
    });
  }

  @Get()
  findStaffMembersForBusiness(@CurrentUser() user: AuthenticatedUser, @Param("businessId") businessId: string) {
    return this.staffService.findStaffMembersForBusiness(businessId, user.id);
  }

  @Get(":staffMemberId")
  getStaffMemberDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("staffMemberId") staffMemberId: string
  ) {
    return this.staffService.getStaffMemberDetails(businessId, staffMemberId, user.id);
  }

  @Patch(":staffMemberId")
  updateStaffMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("staffMemberId") staffMemberId: string,
    @Body() body: UpdateStaffMemberDto
  ) {
    return this.staffService.updateStaffMember({
      businessId,
      displayName: body.displayName,
      requesterUserId: user.id,
      staffMemberId
    });
  }

  @Post(":staffMemberId/deactivate")
  deactivateStaffMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("staffMemberId") staffMemberId: string
  ) {
    return this.staffService.deactivateStaffMember(businessId, staffMemberId, user.id);
  }
}
