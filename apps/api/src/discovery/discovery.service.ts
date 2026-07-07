import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  BUSINESS_HOURS_REPOSITORY,
  type BusinessHour,
  type BusinessHoursRepository
} from "../businesses/business-hours.repository";
import {
  BUSINESS_REPOSITORY,
  type BusinessRepository,
  type PublicBusinessSummary
} from "../businesses/business.repository";
import { createDefaultBusinessHours } from "../businesses/default-business-hours";
import { SERVICE_REPOSITORY, type ServiceRepository } from "../services/service.repository";
import { STAFF_REPOSITORY, type StaffRepository } from "../staff/staff.repository";
import { type DiscoveryCategory, resolveBusinessTypesForCategory } from "./discovery-category";

export interface PublicBusinessProfile extends PublicBusinessSummary {
  businessHours: BusinessHour[];
  isBookable: boolean;
  services: Array<{
    description: string;
    durationMinutes: number;
    id: string;
    name: string;
    price: number | null;
  }>;
  staff: Array<{
    displayName: string;
    id: string;
  }>;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(BUSINESS_HOURS_REPOSITORY) private readonly businessHoursRepository: BusinessHoursRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(STAFF_REPOSITORY) private readonly staffRepository: StaffRepository
  ) {}

  async listBusinesses(category?: DiscoveryCategory, search?: string): Promise<PublicBusinessSummary[]> {
    const businessTypes = category ? resolveBusinessTypesForCategory(category) : undefined;
    const businesses = await this.businessRepository.findActiveBusinesses({ businessTypes, search });

    return businesses.map(toPublicBusinessSummary);
  }

  async getBusinessProfile(businessId: string): Promise<PublicBusinessProfile> {
    const business = await this.businessRepository.findActiveBusinessById(businessId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    const [storedHours, services, staffMembers] = await Promise.all([
      this.businessHoursRepository.findBusinessHours(businessId),
      this.serviceRepository.findServicesForBusiness(businessId),
      this.staffRepository.findStaffMembersForBusiness(businessId)
    ]);
    const businessHours = storedHours.length > 0 ? storedHours : createDefaultBusinessHours(businessId);
    const activeServices = services.filter((service) => service.active);
    const activeStaff = staffMembers.filter((staffMember) => staffMember.active);

    return {
      ...toPublicBusinessSummary(business),
      businessHours,
      isBookable: activeServices.length > 0 && activeStaff.length > 0,
      services: activeServices.map((service) => ({
        description: service.description,
        durationMinutes: service.durationMinutes,
        id: service.id,
        name: service.name,
        price: service.price
      })),
      staff: activeStaff.map((staffMember) => ({
        displayName: staffMember.displayName,
        id: staffMember.id
      }))
    };
  }
}

function toPublicBusinessSummary(
  business: import("../businesses/business.repository").Business
): PublicBusinessSummary {
  return {
    address: business.address,
    businessType: business.businessType,
    city: business.city,
    id: business.id,
    name: business.name,
    timezone: business.timezone
  };
}
