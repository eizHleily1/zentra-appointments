import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AUTH_REPOSITORY, type AuthRepository } from "../auth/auth.repository";
import { normalizeEmail } from "../auth/auth.service";
import { BUSINESS_REPOSITORY, type BusinessRepository } from "../businesses/business.repository";
import { STAFF_REPOSITORY, type StaffMember, type StaffRepository } from "./staff.repository";

interface CreateStaffMemberCommand {
  businessId: string;
  displayName: string;
  requesterUserId: string;
  userEmail?: string;
  userId?: string;
}

interface UpdateStaffMemberCommand {
  businessId: string;
  displayName?: string;
  requesterUserId: string;
  staffMemberId: string;
}

@Injectable()
export class StaffService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(STAFF_REPOSITORY) private readonly staffRepository: StaffRepository
  ) {}

  async createStaffMember(command: CreateStaffMemberCommand): Promise<StaffMember> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const userId = await this.resolveStaffUserId(command);

    try {
      return await this.staffRepository.createStaffMember({
        businessId: command.businessId,
        displayName: normalizeRequiredText(command.displayName, "Staff display name is required"),
        id: randomUUID(),
        userId
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException("Staff member already exists for this business");
      }

      if (isPostgresForeignKeyViolation(error)) {
        throw new BadRequestException("Staff user or business does not exist");
      }

      throw error;
    }
  }

  async findStaffMembersForBusiness(businessId: string, requesterUserId: string): Promise<StaffMember[]> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    return this.staffRepository.findStaffMembersForBusiness(businessId);
  }

  async getStaffMemberDetails(
    businessId: string,
    staffMemberId: string,
    requesterUserId: string
  ): Promise<StaffMember> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const staffMember = await this.staffRepository.findStaffMemberByIdForBusiness(businessId, staffMemberId);

    if (!staffMember) {
      throw new NotFoundException("Staff member not found");
    }

    return staffMember;
  }

  async updateStaffMember(command: UpdateStaffMemberCommand): Promise<StaffMember> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const staffMember = await this.staffRepository.updateStaffMember(command.businessId, command.staffMemberId, {
      displayName:
        command.displayName === undefined
          ? undefined
          : normalizeRequiredText(command.displayName, "Staff display name is required")
    });

    if (!staffMember) {
      throw new NotFoundException("Staff member not found");
    }

    return staffMember;
  }

  async deactivateStaffMember(
    businessId: string,
    staffMemberId: string,
    requesterUserId: string
  ): Promise<StaffMember> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const staffMember = await this.staffRepository.deactivateStaffMember(businessId, staffMemberId);

    if (!staffMember) {
      throw new NotFoundException("Staff member not found");
    }

    return staffMember;
  }

  private async resolveStaffUserId(command: CreateStaffMemberCommand): Promise<string> {
    if (command.userId) {
      return command.userId;
    }

    if (!command.userEmail) {
      throw new BadRequestException("Provide the staff member's account email");
    }

    const account = await this.authRepository.findAccountByEmail(normalizeEmail(command.userEmail));

    if (!account) {
      throw new BadRequestException("No account found with this email. Ask the staff member to register first");
    }

    return account.id;
  }

  private async assertBusinessAccess(userId: string, businessId: string): Promise<void> {
    const membership = await this.businessRepository.findMembership(userId, businessId);

    if (!membership) {
      throw new NotFoundException("Business not found");
    }
  }
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new BadRequestException(message);
  }

  return normalized;
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isPostgresForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
