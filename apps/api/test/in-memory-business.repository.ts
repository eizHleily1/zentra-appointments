import { DEFAULT_BOOKING_INTERVAL_MINUTES } from "../src/businesses/booking-interval";
import type {
  Business,
  BusinessRepository,
  CreateBusinessInput,
  Membership,
  UpdateBusinessInput
} from "../src/businesses/business.repository";
import type { MembershipRole } from "../src/businesses/membership-role";

export class InMemoryBusinessRepository implements BusinessRepository {
  private readonly businesses = new Map<string, Business>();
  private readonly memberships = new Map<string, Membership>();

  async createBusinessWithOwnerMembership(
    input: CreateBusinessInput
  ): Promise<{ business: Business; membership: Membership }> {
    const now = new Date();
    const business: Business = {
      address: null,
      bookingIntervalMinutes: DEFAULT_BOOKING_INTERVAL_MINUTES,
      businessType: input.businessType,
      city: null,
      createdAt: now,
      id: input.id,
      initialOwnerUserId: input.initialOwnerUserId,
      name: input.name,
      status: "PENDING_ONBOARDING",
      timezone: input.timezone,
      updatedAt: now
    };
    const membership: Membership = {
      businessId: business.id,
      createdAt: now,
      id: input.membershipId,
      role: "OWNER",
      updatedAt: now,
      userId: input.initialOwnerUserId
    };

    this.businesses.set(business.id, business);
    this.memberships.set(membership.id, membership);

    return { business, membership };
  }

  async findBusinessesForUser(userId: string): Promise<Business[]> {
    const businessIds = new Set(
      Array.from(this.memberships.values())
        .filter((membership) => membership.userId === userId)
        .map((membership) => membership.businessId)
    );

    return Array.from(this.businesses.values()).filter((business) => businessIds.has(business.id));
  }

  async findActiveBusinesses(
    options?: import("../src/businesses/business.repository").FindActiveBusinessesOptions
  ): Promise<Business[]> {
    const search = options?.search?.trim().toLowerCase();
    const businessTypes = options?.businessTypes;

    return Array.from(this.businesses.values())
      .filter((business) => {
        if (business.status !== "ACTIVE") {
          return false;
        }

        if (businessTypes && businessTypes.length > 0 && !businessTypes.includes(business.businessType)) {
          return false;
        }

        if (search && !business.name.toLowerCase().includes(search)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async findActiveBusinessById(businessId: string): Promise<Business | null> {
    const business = this.businesses.get(businessId);

    if (!business || business.status !== "ACTIVE") {
      return null;
    }

    return business;
  }

  async findBusinessById(businessId: string): Promise<Business | null> {
    return this.businesses.get(businessId) ?? null;
  }

  async findBusinessByIdForUser(businessId: string, userId: string): Promise<Business | null> {
    const membership = await this.findMembership(userId, businessId);

    if (!membership) {
      return null;
    }

    return this.businesses.get(businessId) ?? null;
  }

  async findMembership(userId: string, businessId: string): Promise<Membership | null> {
    return (
      Array.from(this.memberships.values()).find(
        (membership) => membership.userId === userId && membership.businessId === businessId
      ) ?? null
    );
  }

  async updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business | null> {
    const business = this.businesses.get(id);

    if (!business) {
      return null;
    }

    const updatedBusiness: Business = {
      ...business,
      address: input.address === undefined ? business.address : input.address,
      businessType: input.businessType ?? business.businessType,
      city: input.city === undefined ? business.city : input.city,
      name: input.name ?? business.name,
      timezone: input.timezone ?? business.timezone,
      updatedAt: new Date()
    };

    this.businesses.set(id, updatedBusiness);
    return updatedBusiness;
  }

  async deactivateBusiness(id: string): Promise<Business | null> {
    const business = this.businesses.get(id);

    if (!business) {
      return null;
    }

    const deactivatedBusiness: Business = {
      ...business,
      status: "DEACTIVATED",
      updatedAt: new Date()
    };

    this.businesses.set(id, deactivatedBusiness);
    return deactivatedBusiness;
  }

  async publishBusiness(id: string): Promise<Business | null> {
    const business = this.businesses.get(id);

    if (!business || business.status !== "PENDING_ONBOARDING") {
      return null;
    }

    const publishedBusiness: Business = {
      ...business,
      status: "ACTIVE",
      updatedAt: new Date()
    };

    this.businesses.set(id, publishedBusiness);
    return publishedBusiness;
  }

  addMembership(userId: string, businessId: string, role: MembershipRole): void {
    const now = new Date();
    const membership: Membership = {
      businessId,
      createdAt: now,
      id: `${userId}:${businessId}:${role}`,
      role,
      updatedAt: now,
      userId
    };

    this.memberships.set(membership.id, membership);
  }

  setBusinessStatus(businessId: string, status: Business["status"]): void {
    const business = this.businesses.get(businessId);

    if (business) {
      this.businesses.set(businessId, { ...business, status, updatedAt: new Date() });
    }
  }

  getBusinesses(): Business[] {
    return Array.from(this.businesses.values());
  }

  getMemberships(): Membership[] {
    return Array.from(this.memberships.values());
  }
}
