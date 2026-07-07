import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  Client,
  ClientRepository,
  CreateClientInput,
  FindClientsOptions,
  UpdateClientInput
} from "./client.repository";

interface ClientRow {
  active: boolean;
  business_id: string;
  created_at: Date;
  display_name: string;
  email: string | null;
  id: string;
  linked_user_id: string | null;
  phone_number: string | null;
  updated_at: Date;
}

@Injectable()
export class PostgresClientRepository implements ClientRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createClient(input: CreateClientInput): Promise<Client> {
    const result = await this.databaseService.query<ClientRow>(
      `
        INSERT INTO clients (
          id,
          business_id,
          display_name,
          phone_number,
          email,
          linked_user_id,
          active
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `,
      [input.id, input.businessId, input.displayName, input.phoneNumber, input.email, input.linkedUserId]
    );

    return mapClient(result.rows[0]);
  }

  async findClientsForBusiness(businessId: string, options?: FindClientsOptions): Promise<Client[]> {
    const search = options?.search?.trim();

    if (search) {
      const normalizedSearch = search.replace(/\D/g, "");
      const result = await this.databaseService.query<ClientRow>(
        `
          SELECT *
          FROM clients
          WHERE business_id = $1
            AND active = true
            AND (
              display_name ILIKE $2
              OR ($3 <> '' AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') LIKE $4)
              OR COALESCE(email, '') ILIKE $2
            )
          ORDER BY display_name ASC, created_at ASC
        `,
        [businessId, `%${search}%`, normalizedSearch, `%${normalizedSearch}%`]
      );

      return result.rows.map(mapClient);
    }

    const result = await this.databaseService.query<ClientRow>(
      "SELECT * FROM clients WHERE business_id = $1 AND active = true ORDER BY display_name ASC, created_at ASC",
      [businessId]
    );

    return result.rows.map(mapClient);
  }

  async findClientByIdForBusiness(businessId: string, clientId: string): Promise<Client | null> {
    const result = await this.databaseService.query<ClientRow>(
      "SELECT * FROM clients WHERE business_id = $1 AND id = $2 LIMIT 1",
      [businessId, clientId]
    );

    return result.rows[0] ? mapClient(result.rows[0]) : null;
  }

  async findClientByLinkedUserIdForBusiness(
    businessId: string,
    linkedUserId: string
  ): Promise<Client | null> {
    const result = await this.databaseService.query<ClientRow>(
      `
        SELECT *
        FROM clients
        WHERE business_id = $1 AND linked_user_id = $2
        LIMIT 1
      `,
      [businessId, linkedUserId]
    );

    return result.rows[0] ? mapClient(result.rows[0]) : null;
  }

  async findClientsByLinkedUserId(linkedUserId: string): Promise<Client[]> {
    const result = await this.databaseService.query<ClientRow>(
      `
        SELECT *
        FROM clients
        WHERE linked_user_id = $1
        ORDER BY created_at ASC
      `,
      [linkedUserId]
    );

    return result.rows.map(mapClient);
  }

  async findActiveClientByNormalizedPhoneForBusiness(
    businessId: string,
    normalizedPhone: string,
    excludeClientId?: string
  ): Promise<Client | null> {
    const result = await this.databaseService.query<ClientRow>(
      `
        SELECT *
        FROM clients
        WHERE business_id = $1
          AND active = true
          AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $2
          AND ($3::uuid IS NULL OR id <> $3)
        LIMIT 1
      `,
      [businessId, normalizedPhone, excludeClientId ?? null]
    );

    return result.rows[0] ? mapClient(result.rows[0]) : null;
  }

  async updateClient(businessId: string, clientId: string, input: UpdateClientInput): Promise<Client | null> {
    const result = await this.databaseService.query<ClientRow>(
      `
        UPDATE clients
        SET display_name = COALESCE($3, display_name),
            phone_number = CASE WHEN $4::boolean THEN $5 ELSE phone_number END,
            email = CASE WHEN $6::boolean THEN $7 ELSE email END,
            updated_at = now()
        WHERE business_id = $1 AND id = $2
        RETURNING *
      `,
      [
        businessId,
        clientId,
        input.displayName ?? null,
        input.phoneNumber !== undefined,
        input.phoneNumber ?? null,
        input.email !== undefined,
        input.email ?? null
      ]
    );

    return result.rows[0] ? mapClient(result.rows[0]) : null;
  }

  async deactivateClient(businessId: string, clientId: string): Promise<Client | null> {
    const result = await this.databaseService.query<ClientRow>(
      `
        UPDATE clients
        SET active = false,
            updated_at = now()
        WHERE business_id = $1 AND id = $2
        RETURNING *
      `,
      [businessId, clientId]
    );

    return result.rows[0] ? mapClient(result.rows[0]) : null;
  }
}

function mapClient(row: ClientRow): Client {
  return {
    active: row.active,
    businessId: row.business_id,
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
    id: row.id,
    linkedUserId: row.linked_user_id,
    phoneNumber: row.phone_number,
    updatedAt: row.updated_at
  };
}
