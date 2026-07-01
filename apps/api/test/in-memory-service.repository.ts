import type {
  BusinessService,
  CreateServiceInput,
  ServiceRepository,
  UpdateServiceInput
} from "../src/services/service.repository";

export class InMemoryServiceRepository implements ServiceRepository {
  private readonly services = new Map<string, BusinessService>();

  async createService(input: CreateServiceInput): Promise<BusinessService> {
    const now = new Date();
    const service: BusinessService = {
      active: true,
      businessId: input.businessId,
      createdAt: now,
      description: input.description,
      durationMinutes: input.durationMinutes,
      id: input.id,
      name: input.name,
      price: input.price,
      updatedAt: now
    };

    this.services.set(service.id, service);
    return service;
  }

  async findServicesForBusiness(businessId: string): Promise<BusinessService[]> {
    return Array.from(this.services.values()).filter((service) => service.businessId === businessId);
  }

  async findServiceByIdForBusiness(businessId: string, serviceId: string): Promise<BusinessService | null> {
    const service = this.services.get(serviceId);

    if (!service || service.businessId !== businessId) {
      return null;
    }

    return service;
  }

  async updateService(
    businessId: string,
    serviceId: string,
    input: UpdateServiceInput
  ): Promise<BusinessService | null> {
    const service = await this.findServiceByIdForBusiness(businessId, serviceId);

    if (!service) {
      return null;
    }

    const updatedService: BusinessService = {
      ...service,
      description: input.description ?? service.description,
      durationMinutes: input.durationMinutes ?? service.durationMinutes,
      name: input.name ?? service.name,
      price: input.price ?? service.price,
      updatedAt: new Date()
    };

    this.services.set(serviceId, updatedService);
    return updatedService;
  }

  async deactivateService(businessId: string, serviceId: string): Promise<BusinessService | null> {
    const service = await this.findServiceByIdForBusiness(businessId, serviceId);

    if (!service) {
      return null;
    }

    const deactivatedService: BusinessService = {
      ...service,
      active: false,
      updatedAt: new Date()
    };

    this.services.set(serviceId, deactivatedService);
    return deactivatedService;
  }

  getServices(): BusinessService[] {
    return Array.from(this.services.values());
  }
}
