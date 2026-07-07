import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  CreateStaffMemberInput,
  StaffMember,
  StaffRepository,
  UpdateStaffMemberInput
} from "./staff.repository";

interface StaffMemberRow {
  active: boolean;
  business_id: string;
  created_at: Date;
  display_name: string;
  id: string;
  updated_at: Date;
  user_id: string;
}

@Injectable()
export class PostgresStaffRepository implements StaffRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createStaffMember(input: CreateStaffMemberInput): Promise<StaffMember> {
    const result = await this.databaseService.query<StaffMemberRow>(
      `
        INSERT INTO staff_members (id, user_id, business_id, display_name, active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
      `,
      [input.id, input.userId, input.businessId, input.displayName]
    );

    return mapStaffMember(result.rows[0]);
  }

  async findStaffMembersForBusiness(businessId: string): Promise<StaffMember[]> {
    const result = await this.databaseService.query<StaffMemberRow>(
      "SELECT * FROM staff_members WHERE business_id = $1 AND active = true ORDER BY created_at ASC",
      [businessId]
    );

    return result.rows.map(mapStaffMember);
  }

  async findStaffMemberByIdForBusiness(businessId: string, staffMemberId: string): Promise<StaffMember | null> {
    const result = await this.databaseService.query<StaffMemberRow>(
      "SELECT * FROM staff_members WHERE business_id = $1 AND id = $2 LIMIT 1",
      [businessId, staffMemberId]
    );

    return result.rows[0] ? mapStaffMember(result.rows[0]) : null;
  }

  async updateStaffMember(
    businessId: string,
    staffMemberId: string,
    input: UpdateStaffMemberInput
  ): Promise<StaffMember | null> {
    const result = await this.databaseService.query<StaffMemberRow>(
      `
        UPDATE staff_members
        SET display_name = COALESCE($3, display_name),
            updated_at = now()
        WHERE business_id = $1 AND id = $2
        RETURNING *
      `,
      [businessId, staffMemberId, input.displayName ?? null]
    );

    return result.rows[0] ? mapStaffMember(result.rows[0]) : null;
  }

  async deactivateStaffMember(businessId: string, staffMemberId: string): Promise<StaffMember | null> {
    const result = await this.databaseService.query<StaffMemberRow>(
      `
        UPDATE staff_members
        SET active = false,
            updated_at = now()
        WHERE business_id = $1 AND id = $2
        RETURNING *
      `,
      [businessId, staffMemberId]
    );

    return result.rows[0] ? mapStaffMember(result.rows[0]) : null;
  }
}

function mapStaffMember(row: StaffMemberRow): StaffMember {
  return {
    active: row.active,
    businessId: row.business_id,
    createdAt: row.created_at,
    displayName: row.display_name,
    id: row.id,
    updatedAt: row.updated_at,
    userId: row.user_id
  };
}
