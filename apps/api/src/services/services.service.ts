import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { BUSINESS_REPOSITORY, type BusinessRepository } from "../businesses/business.repository";
import {
  SERVICE_REPOSITORY,
  type BusinessService,
  type ServiceRepository
} from "./service.repository";

interface CreateServiceCommand {
  businessId: string;
  description: string;
  durationMinutes: number;
  name: string;
  price: number;
  userId: string;
}

interface UpdateServiceCommand {
  businessId: string;
  description?: string;
  durationMinutes?: number;
  name?: string;
  price?: number;
  serviceId: string;
  userId: string;
}

@Injectable()
export class ServicesService {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository
  ) {}

  async createService(command: CreateServiceCommand): Promise<BusinessService> {
    await this.assertBusinessAccess(command.userId, command.businessId);

    return this.serviceRepository.createService({
      businessId: command.businessId,
      description: command.description,
      durationMinutes: command.durationMinutes,
      id: randomUUID(),
      name: normalizeRequiredText(command.name, "Service name is required"),
      price: command.price
    });
  }

  async findServicesForBusiness(businessId: string, userId: string): Promise<BusinessService[]> {
    await this.assertBusinessAccess(userId, businessId);

    return this.serviceRepository.findServicesForBusiness(businessId);
  }

  async getServiceDetails(businessId: string, serviceId: string, userId: string): Promise<BusinessService> {
    await this.assertBusinessAccess(userId, businessId);

    const service = await this.serviceRepository.findServiceByIdForBusiness(businessId, serviceId);

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    return service;
  }

  async updateService(command: UpdateServiceCommand): Promise<BusinessService> {
    await this.assertBusinessAccess(command.userId, command.businessId);

    const service = await this.serviceRepository.updateService(command.businessId, command.serviceId, {
      description: command.description,
      durationMinutes: command.durationMinutes,
      name: command.name === undefined ? undefined : normalizeRequiredText(command.name, "Service name is required"),
      price: command.price
    });

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    return service;
  }

  async deactivateService(businessId: string, serviceId: string, userId: string): Promise<BusinessService> {
    await this.assertBusinessAccess(userId, businessId);

    const service = await this.serviceRepository.deactivateService(businessId, serviceId);

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    return service;
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
