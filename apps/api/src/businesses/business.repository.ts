import type { BusinessType } from "../tenants/business-type";
import type { TenantStatus } from "../tenants/tenant-status";
import type { MembershipRole } from "./membership-role";

export const BUSINESS_REPOSITORY = Symbol("BUSINESS_REPOSITORY");

export interface Business {
  businessType: BusinessType;
  createdAt: Date;
  id: string;
  initialOwnerUserId: string;
  name: string;
  status: TenantStatus;
  timezone: string;
  updatedAt: Date;
}

export interface Membership {
  businessId: string;
  createdAt: Date;
  id: string;
  role: MembershipRole;
  updatedAt: Date;
  userId: string;
}

export interface CreateBusinessInput {
  businessType: BusinessType;
  id: string;
  initialOwnerUserId: string;
  membershipId: string;
  name: string;
  timezone: string;
}

export interface UpdateBusinessInput {
  businessType?: BusinessType;
  name?: string;
  timezone?: string;
}

export interface BusinessRepository {
  createBusinessWithOwnerMembership(input: CreateBusinessInput): Promise<{ business: Business; membership: Membership }>;
  deactivateBusiness(id: string): Promise<Business | null>;
  findBusinessByIdForUser(businessId: string, userId: string): Promise<Business | null>;
  findBusinessesForUser(userId: string): Promise<Business[]>;
  findMembership(userId: string, businessId: string): Promise<Membership | null>;
  updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business | null>;
}
