import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  CreateTenantInput,
  Tenant,
  TenantRepository,
  UpdateTenantInput
} from "./tenant.repository";

interface TenantRow {
  business_type: Tenant["businessType"];
  created_at: Date;
  id: string;
  initial_owner_user_id: string;
  name: string;
  status: Tenant["status"];
  timezone: string;
  updated_at: Date;
}

@Injectable()
export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const result = await this.databaseService.query<TenantRow>(
      `
        INSERT INTO tenants (id, name, business_type, timezone, status, initial_owner_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [input.id, input.name, input.businessType, input.timezone, input.status, input.initialOwnerUserId]
    );

    return mapTenant(result.rows[0]);
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    const result = await this.databaseService.query<TenantRow>("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [id]);

    return result.rows[0] ? mapTenant(result.rows[0]) : null;
  }

  async updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant | null> {
    const result = await this.databaseService.query<TenantRow>(
      `
        UPDATE tenants
        SET name = COALESCE($2, name),
            business_type = COALESCE($3, business_type),
            timezone = COALESCE($4, timezone),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, input.name ?? null, input.businessType ?? null, input.timezone ?? null]
    );

    return result.rows[0] ? mapTenant(result.rows[0]) : null;
  }

  async deactivateTenant(id: string): Promise<Tenant | null> {
    const result = await this.databaseService.query<TenantRow>(
      `
        UPDATE tenants
        SET status = 'DEACTIVATED',
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id]
    );

    return result.rows[0] ? mapTenant(result.rows[0]) : null;
  }
}

function mapTenant(row: TenantRow): Tenant {
  return {
    businessType: row.business_type,
    createdAt: row.created_at,
    id: row.id,
    initialOwnerUserId: row.initial_owner_user_id,
    name: row.name,
    status: row.status,
    timezone: row.timezone,
    updatedAt: row.updated_at
  };
}
