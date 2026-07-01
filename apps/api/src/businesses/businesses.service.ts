import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { BusinessType } from "../tenants/business-type";
import { BUSINESS_REPOSITORY, type Business, type BusinessRepository } from "./business.repository";

interface CreateBusinessCommand {
  businessType: BusinessType;
  name: string;
  ownerUserId: string;
  timezone: string;
}

interface UpdateBusinessCommand {
  businessId: string;
  businessType?: BusinessType;
  name?: string;
  requesterUserId: string;
  timezone?: string;
}

@Injectable()
export class BusinessesService {
  constructor(@Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository) {}

  async createBusiness(command: CreateBusinessCommand): Promise<Business> {
    const result = await this.businessRepository.createBusinessWithOwnerMembership({
      businessType: command.businessType,
      id: randomUUID(),
      initialOwnerUserId: command.ownerUserId,
      membershipId: randomUUID(),
      name: normalizeRequiredText(command.name, "Business name is required"),
      timezone: normalizeRequiredText(command.timezone, "Business timezone is required")
    });

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
      businessType: command.businessType,
      name: command.name === undefined ? undefined : normalizeRequiredText(command.name, "Business name is required"),
      timezone:
        command.timezone === undefined
          ? undefined
          : normalizeRequiredText(command.timezone, "Business timezone is required")
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
