import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  Business,
  BusinessRepository,
  CreateBusinessInput,
  Membership,
  UpdateBusinessInput
} from "./business.repository";

interface BusinessRow {
  business_type: Business["businessType"];
  created_at: Date;
  id: string;
  initial_owner_user_id: string;
  name: string;
  status: Business["status"];
  timezone: string;
  updated_at: Date;
}

interface MembershipRow {
  business_id: string;
  created_at: Date;
  id: string;
  role: Membership["role"];
  updated_at: Date;
  user_id: string;
}

@Injectable()
export class PostgresBusinessRepository implements BusinessRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createBusinessWithOwnerMembership(
    input: CreateBusinessInput
  ): Promise<{ business: Business; membership: Membership }> {
    return this.databaseService.transaction(async (client) => {
      const businessResult = await client.query<BusinessRow>(
        `
          INSERT INTO tenants (id, name, business_type, timezone, status, initial_owner_user_id)
          VALUES ($1, $2, $3, $4, 'PENDING_ONBOARDING', $5)
          RETURNING *
        `,
        [input.id, input.name, input.businessType, input.timezone, input.initialOwnerUserId]
      );
      const membershipResult = await client.query<MembershipRow>(
        `
          INSERT INTO memberships (id, user_id, business_id, role)
          VALUES ($1, $2, $3, 'OWNER')
          RETURNING *
        `,
        [input.membershipId, input.initialOwnerUserId, input.id]
      );

      return {
        business: mapBusiness(businessResult.rows[0]),
        membership: mapMembership(membershipResult.rows[0])
      };
    });
  }

  async findBusinessesForUser(userId: string): Promise<Business[]> {
    const result = await this.databaseService.query<BusinessRow>(
      `
        SELECT tenants.*
        FROM tenants
        INNER JOIN memberships ON memberships.business_id = tenants.id
        WHERE memberships.user_id = $1
        ORDER BY tenants.created_at ASC
      `,
      [userId]
    );

    return result.rows.map(mapBusiness);
  }

  async findBusinessByIdForUser(businessId: string, userId: string): Promise<Business | null> {
    const result = await this.databaseService.query<BusinessRow>(
      `
        SELECT tenants.*
        FROM tenants
        INNER JOIN memberships ON memberships.business_id = tenants.id
        WHERE tenants.id = $1 AND memberships.user_id = $2
        LIMIT 1
      `,
      [businessId, userId]
    );

    return result.rows[0] ? mapBusiness(result.rows[0]) : null;
  }

  async findMembership(userId: string, businessId: string): Promise<Membership | null> {
    const result = await this.databaseService.query<MembershipRow>(
      "SELECT * FROM memberships WHERE user_id = $1 AND business_id = $2 LIMIT 1",
      [userId, businessId]
    );

    return result.rows[0] ? mapMembership(result.rows[0]) : null;
  }

  async updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business | null> {
    const result = await this.databaseService.query<BusinessRow>(
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

    return result.rows[0] ? mapBusiness(result.rows[0]) : null;
  }

  async deactivateBusiness(id: string): Promise<Business | null> {
    const result = await this.databaseService.query<BusinessRow>(
      `
        UPDATE tenants
        SET status = 'DEACTIVATED',
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id]
    );

    return result.rows[0] ? mapBusiness(result.rows[0]) : null;
  }
}

function mapBusiness(row: BusinessRow): Business {
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

function mapMembership(row: MembershipRow): Membership {
  return {
    businessId: row.business_id,
    createdAt: row.created_at,
    id: row.id,
    role: row.role,
    updatedAt: row.updated_at,
    userId: row.user_id
  };
}
