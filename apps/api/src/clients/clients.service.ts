import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { BUSINESS_REPOSITORY, type BusinessRepository } from "../businesses/business.repository";
import { deriveClientDisplayNameFromEmail } from "./legacy-client-backfill";
import { normalizeOptionalEmail, normalizePhoneNumber } from "./client-phone";
import { CLIENT_REPOSITORY, type Client, type ClientRepository } from "./client.repository";

interface CreateClientCommand {
  businessId: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  requesterUserId: string;
}

interface UpdateClientCommand {
  businessId: string;
  clientId: string;
  displayName?: string;
  email?: string | null;
  phoneNumber?: string | null;
  requesterUserId: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepository: BusinessRepository,
    @Inject(CLIENT_REPOSITORY) private readonly clientRepository: ClientRepository
  ) {}

  async createClient(command: CreateClientCommand): Promise<Client> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const displayName = normalizeRequiredText(command.displayName, "Client name is required");
    const phoneNumber = normalizeOptionalPhoneForStorage(command.phoneNumber);
    const email = normalizeOptionalEmail(command.email);

    await this.assertNoDuplicateActivePhone(command.businessId, phoneNumber);

    try {
      return await this.clientRepository.createClient({
        businessId: command.businessId,
        displayName,
        email,
        id: randomUUID(),
        linkedUserId: null,
        phoneNumber
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException("A client with this phone number already exists");
      }

      if (isPostgresForeignKeyViolation(error)) {
        throw new BadRequestException("Business does not exist");
      }

      throw error;
    }
  }

  async findClientsForBusiness(
    businessId: string,
    requesterUserId: string,
    search?: string
  ): Promise<Client[]> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    return this.clientRepository.findClientsForBusiness(businessId, { search });
  }

  async getClientDetails(businessId: string, clientId: string, requesterUserId: string): Promise<Client> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const client = await this.clientRepository.findClientByIdForBusiness(businessId, clientId);

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    return client;
  }

  async updateClient(command: UpdateClientCommand): Promise<Client> {
    await this.assertBusinessAccess(command.requesterUserId, command.businessId);

    const existingClient = await this.clientRepository.findClientByIdForBusiness(
      command.businessId,
      command.clientId
    );

    if (!existingClient) {
      throw new NotFoundException("Client not found");
    }

    const displayName =
      command.displayName === undefined
        ? undefined
        : normalizeRequiredText(command.displayName, "Client name is required");
    const phoneNumber =
      command.phoneNumber === undefined ? undefined : normalizeOptionalPhoneForStorage(command.phoneNumber);
    const email = command.email === undefined ? undefined : normalizeOptionalEmail(command.email);

    if (phoneNumber !== undefined) {
      await this.assertNoDuplicateActivePhone(command.businessId, phoneNumber, command.clientId);
    }

    try {
      const client = await this.clientRepository.updateClient(command.businessId, command.clientId, {
        displayName,
        email,
        phoneNumber
      });

      if (!client) {
        throw new NotFoundException("Client not found");
      }

      return client;
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException("A client with this phone number already exists");
      }

      throw error;
    }
  }

  async deactivateClient(businessId: string, clientId: string, requesterUserId: string): Promise<Client> {
    await this.assertBusinessAccess(requesterUserId, businessId);

    const client = await this.clientRepository.deactivateClient(businessId, clientId);

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    return client;
  }

  async getActiveClientForBooking(businessId: string, clientId: string): Promise<Client> {
    const client = await this.clientRepository.findClientByIdForBusiness(businessId, clientId);

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    if (!client.active) {
      throw new BadRequestException("Client is not available");
    }

    return client;
  }

  async resolveLinkedClientForUser(input: {
    businessId: string;
    userEmail: string;
    userId: string;
  }): Promise<Client> {
    const existingClient = await this.clientRepository.findClientByLinkedUserIdForBusiness(
      input.businessId,
      input.userId
    );

    if (existingClient) {
      if (!existingClient.active) {
        throw new BadRequestException("Client is not available");
      }

      return existingClient;
    }

    const displayName = deriveClientDisplayNameFromEmail(input.userEmail);
    const email = normalizeOptionalEmail(input.userEmail);

    return this.clientRepository.createClient({
      businessId: input.businessId,
      displayName,
      email,
      id: randomUUID(),
      linkedUserId: input.userId,
      phoneNumber: null
    });
  }

  findClientsLinkedToUser(userId: string): Promise<Client[]> {
    return this.clientRepository.findClientsByLinkedUserId(userId);
  }

  private async assertNoDuplicateActivePhone(
    businessId: string,
    phoneNumber: string | null,
    excludeClientId?: string
  ): Promise<void> {
    if (!phoneNumber) {
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      return;
    }

    const existingClient = await this.clientRepository.findActiveClientByNormalizedPhoneForBusiness(
      businessId,
      normalizedPhone,
      excludeClientId
    );

    if (existingClient) {
      throw new ConflictException("A client with this phone number already exists");
    }
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

function normalizeOptionalPhoneForStorage(phoneNumber: string | null | undefined): string | null {
  if (phoneNumber === null || phoneNumber === undefined) {
    return null;
  }

  const trimmed = phoneNumber.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isPostgresForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
