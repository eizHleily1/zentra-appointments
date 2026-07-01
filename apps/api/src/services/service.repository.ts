export const SERVICE_REPOSITORY = Symbol("SERVICE_REPOSITORY");

export interface BusinessService {
  active: boolean;
  businessId: string;
  createdAt: Date;
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
  price: number;
  updatedAt: Date;
}

export interface CreateServiceInput {
  businessId: string;
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
  price: number;
}

export interface UpdateServiceInput {
  description?: string;
  durationMinutes?: number;
  name?: string;
  price?: number;
}

export interface ServiceRepository {
  createService(input: CreateServiceInput): Promise<BusinessService>;
  deactivateService(businessId: string, serviceId: string): Promise<BusinessService | null>;
  findServiceByIdForBusiness(businessId: string, serviceId: string): Promise<BusinessService | null>;
  findServicesForBusiness(businessId: string): Promise<BusinessService[]>;
  updateService(businessId: string, serviceId: string, input: UpdateServiceInput): Promise<BusinessService | null>;
}
