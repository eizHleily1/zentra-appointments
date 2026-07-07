import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { BusinessType } from "../tenants/business-type";
import { SERVICE_REPOSITORY, type ServiceRepository } from "../services/service.repository";
import { STAFF_REPOSITORY, type StaffRepository } from "../staff/staff.repository";
import {
  BUSINESS_HOURS_REPOSITORY,
  type BusinessHour,
  type BusinessHoursRepository
} from "./business-hours.repository";
import { BUSINESS_REPOSITORY, type Business, type BusinessRepository } from "./business.repository";
import { createDefaultBusinessHours } from "./default-business-hours";
import type { BusinessHourEntryDto } from "./dto/update-business-hours.dto";
import { buildPublishReadiness, type PublishReadiness } from "./publish-readiness";

interface CreateBusinessCommand {
  businessType: BusinessType;
  name: string;
  ownerUserId: string;
  timezone: string;
}

interface UpdateBusinessCommand {
  address?: string | null;
  businessId: string;
  businessType?: BusinessType;
  city?: string | null;
  name?: string;
  requesterUserId: string;
  timezone?: string;
}

@Injectable()
export class BusinessesService {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(BUSINESS_HOURS_REPOSITORY) private readonly businessHoursRepository: BusinessHoursRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(STAFF_REPOSITORY) private readonly staffRepository: StaffRepository
  ) {}

  async createBusiness(command: CreateBusinessCommand): Promise<Business> {
    const result = await this.businessRepository.createBusinessWithOwnerMembership({
      businessType: command.businessType,
      id: randomUUID(),
      initialOwnerUserId: command.ownerUserId,
      membershipId: randomUUID(),
      name: normalizeRequiredText(command.name, "Business name is required"),
      timezone: normalizeTimezone(command.timezone)
    });

    await this.businessHoursRepository.replaceBusinessHours(
      result.business.id,
      createDefaultBusinessHours(result.business.id)
    );

    return result.business;
  }

  findMyBusinesses(userId: string): Promise<Business[]> {
    return this.businessRepository.findBusinessesForUser(userId);
  }

  async getBusinessDetails(businessId: string, userId: string): Promise<Business> {
    const business = await this.businessRepository.findBusinessByIdForUser(businessId, userId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async updateBusiness(command: UpdateBusinessCommand): Promise<Business> {
    await this.assertOwnerMembership(command.requesterUserId, command.businessId);

    const business = await this.businessRepository.updateBusiness(command.businessId, {
      address: command.address,
      businessType: command.businessType,
      city: command.city,
      name: command.name === undefined ? undefined : normalizeRequiredText(command.name, "Business name is required"),
      timezone: command.timezone === undefined ? undefined : normalizeTimezone(command.timezone)
    });

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async deactivateBusiness(businessId: string, requesterUserId: string): Promise<Business> {
    await this.assertOwnerMembership(requesterUserId, businessId);

    const business = await this.businessRepository.deactivateBusiness(businessId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async getPublishReadiness(businessId: string, requesterUserId: string): Promise<PublishReadiness> {
    await this.assertOwnerMembership(requesterUserId, businessId);

    const business = await this.businessRepository.findBusinessByIdForUser(businessId, requesterUserId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    const [services, staffMembers] = await Promise.all([
      this.serviceRepository.findServicesForBusiness(businessId),
      this.staffRepository.findStaffMembersForBusiness(businessId)
    ]);

    return buildPublishReadiness({
      activeServiceCount: services.length,
      activeStaffCount: staffMembers.length,
      business
    });
  }

  async publishBusiness(businessId: string, requesterUserId: string): Promise<Business> {
    await this.assertOwnerMembership(requesterUserId, businessId);

    const business = await this.businessRepository.findBusinessByIdForUser(businessId, requesterUserId);

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    if (business.status === "ACTIVE") {
      return business;
    }

    if (business.status !== "PENDING_ONBOARDING") {
      throw new BadRequestException("This business cannot be published");
    }

    const readiness = await this.getPublishReadiness(businessId, requesterUserId);

    if (!readiness.canPublish) {
      throw new BadRequestException(readiness.missingSteps.join(". "));
    }

    const publishedBusiness = await this.businessRepository.publishBusiness(businessId);

    if (!publishedBusiness) {
      throw new NotFoundException("Business not found");
    }

    return publishedBusiness;
  }

  async getBusinessHours(businessId: string, requesterUserId: string): Promise<BusinessHour[]> {
    await this.assertBusinessMembership(requesterUserId, businessId);

    const hours = await this.businessHoursRepository.findBusinessHours(businessId);

    if (hours.length > 0) {
      return hours;
    }

    return createDefaultBusinessHours(businessId);
  }

  async updateBusinessHours(
    businessId: string,
    requesterUserId: string,
    hours: BusinessHourEntryDto[]
  ): Promise<BusinessHour[]> {
    await this.assertOwnerMembership(requesterUserId, businessId);

    const normalizedHours = normalizeBusinessHoursInput(businessId, hours);

    return this.businessHoursRepository.replaceBusinessHours(businessId, normalizedHours);
  }

  private async assertBusinessMembership(userId: string, businessId: string): Promise<void> {
    const membership = await this.businessRepository.findMembership(userId, businessId);

    if (!membership) {
      throw new NotFoundException("Business not found");
    }
  }

  private async assertOwnerMembership(userId: string, businessId: string): Promise<void> {
    const membership = await this.businessRepository.findMembership(userId, businessId);

    if (!membership) {
      throw new NotFoundException("Business not found");
    }

    if (membership.role !== "OWNER") {
      throw new ForbiddenException("Business operation requires owner membership");
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

// Scheduling relies on Intl with the stored timezone; an invalid IANA name
// would crash slot generation later, so reject it at the door.
function normalizeTimezone(value: string): string {
  const timezone = normalizeRequiredText(value, "Business timezone is required");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new BadRequestException(
      `"${timezone}" is not a valid timezone. Use an IANA timezone name such as "Asia/Jerusalem"`
    );
  }

  return timezone;
}

function normalizeBusinessHoursInput(businessId: string, hours: BusinessHourEntryDto[]) {
  const uniqueDays = new Set(hours.map((hour) => hour.dayOfWeek));

  if (uniqueDays.size !== 7) {
    throw new BadRequestException("Business hours must include all 7 days of the week");
  }

  return hours.map((hour) => {
    if (hour.isClosed) {
      return {
        businessId,
        closeTime: null,
        dayOfWeek: hour.dayOfWeek,
        id: randomUUID(),
        isClosed: true,
        openTime: null
      };
    }

    if (!hour.openTime || !hour.closeTime) {
      throw new BadRequestException("Open and close times are required for working days");
    }

    if (hour.openTime >= hour.closeTime) {
      throw new BadRequestException("Close time must be after open time");
    }

    return {
      businessId,
      closeTime: hour.closeTime,
      dayOfWeek: hour.dayOfWeek,
      id: randomUUID(),
      isClosed: false,
      openTime: hour.openTime
    };
  });
}
