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

/** Which of the two partial unique indexes on `clients` an identity lookup targets. */
export type ClientLinkage = "linked" | "unlinked";

export interface FindClientIdentityInput {
  businessId: string;
  /**
   * Raw name as entered. PostgreSQL applies `normalize_client_display_name` to both this
   * value and the stored column, matching the unique indexes. Callers must not
   * pre-lowercase it: JavaScript and PostgreSQL case-fold some Unicode differently.
   */
  displayName: string;
  excludeClientId?: string;
  linkage: ClientLinkage;
  normalizedPhone: string;
}

export interface ClientRepository {
  createClient(input: CreateClientInput): Promise<Client>;
  deactivateClient(businessId: string, clientId: string): Promise<Client | null>;
  /**
   * Finds an active client with the same identity within one linkage class. Linked and
   * unlinked records are matched separately because the database allows one of each to
   * coexist, so a guest booking and a registered account can share a phone and name.
   */
  findActiveClientMatchingIdentity(input: FindClientIdentityInput): Promise<Client | null>;
  findClientByIdForBusiness(businessId: string, clientId: string): Promise<Client | null>;
  findClientByLinkedUserIdForBusiness(businessId: string, linkedUserId: string): Promise<Client | null>;
  findClientsByLinkedUserId(linkedUserId: string): Promise<Client[]>;
  findClientsForBusiness(businessId: string, options?: FindClientsOptions): Promise<Client[]>;
  updateClient(businessId: string, clientId: string, input: UpdateClientInput): Promise<Client | null>;
}
