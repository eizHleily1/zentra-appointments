export const STAFF_REPOSITORY = Symbol("STAFF_REPOSITORY");

export interface StaffMember {
  active: boolean;
  businessId: string;
  createdAt: Date;
  displayName: string;
  id: string;
  updatedAt: Date;
  userId: string;
}

export interface CreateStaffMemberInput {
  businessId: string;
  displayName: string;
  id: string;
  userId: string;
}

export interface UpdateStaffMemberInput {
  displayName?: string;
}

export interface StaffRepository {
  createStaffMember(input: CreateStaffMemberInput): Promise<StaffMember>;
  deactivateStaffMember(businessId: string, staffMemberId: string): Promise<StaffMember | null>;
  findStaffMemberByIdForBusiness(businessId: string, staffMemberId: string): Promise<StaffMember | null>;
  findStaffMembersForBusiness(businessId: string): Promise<StaffMember[]>;
  updateStaffMember(
    businessId: string,
    staffMemberId: string,
    input: UpdateStaffMemberInput
  ): Promise<StaffMember | null>;
}
