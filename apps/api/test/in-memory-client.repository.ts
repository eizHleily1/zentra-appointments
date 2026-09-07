import { normalizePhoneNumber } from "../src/clients/client-phone";
import type {
  Client,
  ClientRepository,
  CreateClientInput,
  FindClientIdentityInput,
  FindClientsOptions,
  UpdateClientInput
} from "../src/clients/client.repository";

/**
 * Approximates PostgreSQL's `normalize_client_display_name` for the in-memory double only.
 * The two engines case-fold some Unicode differently, so production never folds names in
 * JavaScript; `PostgresClientRepository` is the authority and has its own Unicode test.
 */
function foldDisplayName(displayName: string): string {
  return displayName.trim().toLowerCase();
}

export class InMemoryClientRepository implements ClientRepository {
  private readonly clients = new Map<string, Client>();

  async createClient(input: CreateClientInput): Promise<Client> {
    const normalizedPhone = normalizePhoneNumber(input.phoneNumber);

    if (normalizedPhone) {
      // Mirrors the two partial unique indexes: linked and unlinked identities are
      // enforced separately so a guest record can coexist with a linked account.
      const duplicate = this.matchActiveClientByNormalizedPhoneAndName({
        businessId: input.businessId,
        linkage: input.linkedUserId === null ? "unlinked" : "linked",
        displayName: input.displayName,
        normalizedPhone
      });

      if (duplicate) {
        const error = new Error("Duplicate client phone and name");
        Object.assign(error, { code: "23505" });
        throw error;
      }
    }

    const now = new Date();
    const client: Client = {
      active: true,
      businessId: input.businessId,
      createdAt: now,
      displayName: input.displayName,
      email: input.email,
      id: input.id,
      linkedUserId: input.linkedUserId,
      phoneNumber: input.phoneNumber,
      updatedAt: now
    };

    this.clients.set(client.id, client);
    return client;
  }

  async findClientsForBusiness(businessId: string, options?: FindClientsOptions): Promise<Client[]> {
    const search = options?.search?.trim().toLowerCase();

    return Array.from(this.clients.values())
      .filter((client) => {
        if (client.businessId !== businessId || !client.active) {
          return false;
        }

        if (!search) {
          return true;
        }

        const normalizedSearchPhone = search.replace(/\D/g, "");
        const normalizedClientPhone = normalizePhoneNumber(client.phoneNumber) ?? "";

        return (
          client.displayName.toLowerCase().includes(search) ||
          (normalizedSearchPhone.length > 0 && normalizedClientPhone.includes(normalizedSearchPhone)) ||
          (client.email ?? "").toLowerCase().includes(search)
        );
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  async findClientByIdForBusiness(businessId: string, clientId: string): Promise<Client | null> {
    const client = this.clients.get(clientId);

    if (!client || client.businessId !== businessId) {
      return null;
    }

    return client;
  }

  async findClientByLinkedUserIdForBusiness(
    businessId: string,
    linkedUserId: string
  ): Promise<Client | null> {
    return (
      Array.from(this.clients.values()).find(
        (client) => client.businessId === businessId && client.linkedUserId === linkedUserId
      ) ?? null
    );
  }

  async findClientsByLinkedUserId(linkedUserId: string): Promise<Client[]> {
    return Array.from(this.clients.values()).filter((client) => client.linkedUserId === linkedUserId);
  }

  async findActiveClientMatchingIdentity(input: FindClientIdentityInput): Promise<Client | null> {
    return this.matchActiveClientByNormalizedPhoneAndName(input);
  }

  async updateClient(businessId: string, clientId: string, input: UpdateClientInput): Promise<Client | null> {
    const client = await this.findClientByIdForBusiness(businessId, clientId);

    if (!client) {
      return null;
    }

    const nextPhoneNumber = input.phoneNumber === undefined ? client.phoneNumber : input.phoneNumber;
    const nextDisplayName = input.displayName ?? client.displayName;
    const normalizedPhone = normalizePhoneNumber(nextPhoneNumber);

    if (normalizedPhone) {
      const duplicate = this.matchActiveClientByNormalizedPhoneAndName({
        businessId,
        excludeClientId: clientId,
        linkage: client.linkedUserId === null ? "unlinked" : "linked",
        displayName: nextDisplayName,
        normalizedPhone
      });

      if (duplicate) {
        const error = new Error("Duplicate client phone and name");
        Object.assign(error, { code: "23505" });
        throw error;
      }
    }

    const updatedClient: Client = {
      ...client,
      displayName: input.displayName ?? client.displayName,
      email: input.email === undefined ? client.email : input.email,
      phoneNumber: nextPhoneNumber,
      updatedAt: new Date()
    };

    this.clients.set(clientId, updatedClient);
    return updatedClient;
  }

  async deactivateClient(businessId: string, clientId: string): Promise<Client | null> {
    const client = await this.findClientByIdForBusiness(businessId, clientId);

    if (!client) {
      return null;
    }

    const deactivatedClient: Client = {
      ...client,
      active: false,
      updatedAt: new Date()
    };

    this.clients.set(clientId, deactivatedClient);
    return deactivatedClient;
  }

  getClients(): Client[] {
    return Array.from(this.clients.values());
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  private matchActiveClientByNormalizedPhoneAndName(input: FindClientIdentityInput): Client | null {
    return (
      Array.from(this.clients.values()).find((client) => {
        if (client.businessId !== input.businessId || !client.active) {
          return false;
        }

        if (input.excludeClientId && client.id === input.excludeClientId) {
          return false;
        }

        if ((client.linkedUserId === null) !== (input.linkage === "unlinked")) {
          return false;
        }

        return (
          normalizePhoneNumber(client.phoneNumber) === input.normalizedPhone &&
          foldDisplayName(client.displayName) === foldDisplayName(input.displayName)
        );
      }) ?? null
    );
  }
}
