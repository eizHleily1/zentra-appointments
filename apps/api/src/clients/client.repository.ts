export const CLIENT_REPOSITORY = Symbol("CLIENT_REPOSITORY");

export interface Client {
  active: boolean;
  businessId: string;
  createdAt: Date;
  displayName: string;
  email: string | null;
  id: string;
  linkedUserId: string | null;
  phoneNumber: string | null;
  updatedAt: Date;
}

export interface CreateClientInput {
  businessId: string;
  displayName: string;
  email: string | null;
  id: string;
  linkedUserId: string | null;
  phoneNumber: string | null;
}

export interface UpdateClientInput {
  displayName?: string;
  email?: string | null;
  phoneNumber?: string | null;
}

export interface FindClientsOptions {
  search?: string;
}

export interface ClientRepository {
  createClient(input: CreateClientInput): Promise<Client>;
  deactivateClient(businessId: string, clientId: string): Promise<Client | null>;
  findActiveClientByNormalizedPhoneForBusiness(
    businessId: string,
    normalizedPhone: string,
    excludeClientId?: string
  ): Promise<Client | null>;
  findClientByIdForBusiness(businessId: string, clientId: string): Promise<Client | null>;
  findClientByLinkedUserIdForBusiness(businessId: string, linkedUserId: string): Promise<Client | null>;
  findClientsByLinkedUserId(linkedUserId: string): Promise<Client[]>;
  findClientsForBusiness(businessId: string, options?: FindClientsOptions): Promise<Client[]>;
  updateClient(businessId: string, clientId: string, input: UpdateClientInput): Promise<Client | null>;
}
