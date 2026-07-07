import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  BusinessHour,
  BusinessHoursRepository,
  UpsertBusinessHourInput
} from "./business-hours.repository";

interface BusinessHourRow {
  business_id: string;
  close_time: string | null;
  day_of_week: number;
  id: string;
  is_closed: boolean;
  open_time: string | null;
}

@Injectable()
export class PostgresBusinessHoursRepository implements BusinessHoursRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBusinessHours(businessId: string): Promise<BusinessHour[]> {
    const result = await this.databaseService.query<BusinessHourRow>(
      "SELECT * FROM business_hours WHERE business_id = $1 ORDER BY day_of_week ASC",
      [businessId]
    );

    return result.rows.map(mapBusinessHour);
  }

  async replaceBusinessHours(businessId: string, hours: UpsertBusinessHourInput[]): Promise<BusinessHour[]> {
    await this.databaseService.query("DELETE FROM business_hours WHERE business_id = $1", [businessId]);

    for (const hour of hours) {
      await this.databaseService.query(
        `
          INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [hour.id, businessId, hour.dayOfWeek, hour.openTime, hour.closeTime, hour.isClosed]
      );
    }

    return this.findBusinessHours(businessId);
  }
}

function mapBusinessHour(row: BusinessHourRow): BusinessHour {
  return {
    businessId: row.business_id,
    closeTime: row.close_time ? row.close_time.slice(0, 5) : null,
    dayOfWeek: row.day_of_week,
    id: row.id,
    isClosed: row.is_closed,
    openTime: row.open_time ? row.open_time.slice(0, 5) : null
  };
}
