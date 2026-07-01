import type {
  CreateStaffMemberInput,
  StaffMember,
  StaffRepository,
  UpdateStaffMemberInput
} from "../src/staff/staff.repository";

export class InMemoryStaffRepository implements StaffRepository {
  private readonly staffMembers = new Map<string, StaffMember>();

  async createStaffMember(input: CreateStaffMemberInput): Promise<StaffMember> {
    const existingStaffMember = Array.from(this.staffMembers.values()).find(
      (staffMember) => staffMember.businessId === input.businessId && staffMember.userId === input.userId
    );

    if (existingStaffMember) {
      const error = new Error("Duplicate staff member");
      Object.assign(error, { code: "23505" });
      throw error;
    }

    const now = new Date();
    const staffMember: StaffMember = {
      active: true,
      businessId: input.businessId,
      createdAt: now,
      displayName: input.displayName,
      id: input.id,
      updatedAt: now,
      userId: input.userId
    };

    this.staffMembers.set(staffMember.id, staffMember);
    return staffMember;
  }

  async findStaffMembersForBusiness(businessId: string): Promise<StaffMember[]> {
    return Array.from(this.staffMembers.values()).filter((staffMember) => staffMember.businessId === businessId);
  }

  async findStaffMemberByIdForBusiness(businessId: string, staffMemberId: string): Promise<StaffMember | null> {
    const staffMember = this.staffMembers.get(staffMemberId);

    if (!staffMember || staffMember.businessId !== businessId) {
      return null;
    }

    return staffMember;
  }

  async updateStaffMember(
    businessId: string,
    staffMemberId: string,
    input: UpdateStaffMemberInput
  ): Promise<StaffMember | null> {
    const staffMember = await this.findStaffMemberByIdForBusiness(businessId, staffMemberId);

    if (!staffMember) {
      return null;
    }

    const updatedStaffMember: StaffMember = {
      ...staffMember,
      displayName: input.displayName ?? staffMember.displayName,
      updatedAt: new Date()
    };

    this.staffMembers.set(staffMemberId, updatedStaffMember);
    return updatedStaffMember;
  }

  async deactivateStaffMember(businessId: string, staffMemberId: string): Promise<StaffMember | null> {
    const staffMember = await this.findStaffMemberByIdForBusiness(businessId, staffMemberId);

    if (!staffMember) {
      return null;
    }

    const deactivatedStaffMember: StaffMember = {
      ...staffMember,
      active: false,
      updatedAt: new Date()
    };

    this.staffMembers.set(staffMemberId, deactivatedStaffMember);
    return deactivatedStaffMember;
  }

  getStaffMembers(): StaffMember[] {
    return Array.from(this.staffMembers.values());
  }
}
