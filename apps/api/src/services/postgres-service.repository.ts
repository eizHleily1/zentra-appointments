import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  BusinessService,
  CreateServiceInput,
  ServiceRepository,
  UpdateServiceInput
} from "./service.repository";

interface ServiceRow {
  active: boolean;
  business_id: string;
  created_at: Date;
  description: string;
  duration_minutes: number;
  id: string;
  name: string;
  price: string;
  updated_at: Date;
}

@Injectable()
export class PostgresServiceRepository implements ServiceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createService(input: CreateServiceInput): Promise<BusinessService> {
    const result = await this.databaseService.query<ServiceRow>(
      `
        INSERT INTO services (id, business_id, name, description, duration_minutes, price, active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `,
      [input.id, input.businessId, input.name, input.description, input.durationMinutes, input.price]
    );

    return mapService(result.rows[0]);
  }

  async findServicesForBusiness(businessId: string): Promise<BusinessService[]> {
    const result = await this.databaseService.query<ServiceRow>(
      "SELECT * FROM services WHERE business_id = $1 ORDER BY created_at ASC",
      [businessId]
    );

    return result.rows.map(mapService);
  }

  async findServiceByIdForBusiness(businessId: string, serviceId: string): Promise<BusinessService | null> {
    const result = await this.databaseService.query<ServiceRow>(
      "SELECT * FROM services WHERE business_id = $1 AND id = $2 LIMIT 1",
      [businessId, serviceId]
    );

    return result.rows[0] ? mapService(result.rows[0]) : null;
  }

  async updateService(
    businessId: string,
    serviceId: string,
    input: UpdateServiceInput
  ): Promise<BusinessService | null> {
    const result = await this.databaseService.query<ServiceRow>(
      `
        UPDATE services
        SET name = COALESCE($3, name),
            description = COALESCE($4, description),
            duration_minutes = COALESCE($5, duration_minutes),
            price = COALESCE($6, price),
            updated_at = now()
        WHERE business_id = $1 AND id = $2
        RETURNING *
      `,
      [
        businessId,
        serviceId,
        input.name ?? null,
        input.description ?? null,
        input.durationMinutes ?? null,
        input.price ?? null
      ]
    );

    return result.rows[0] ? mapService(result.rows[0]) : null;
  }

  async deactivateService(businessId: string, serviceId: string): Promise<BusinessService | null> {
    const result = await this.databaseService.query<ServiceRow>(
      `
        UPDATE services
        SET active = false,
            updated_at = now()
        WHERE business_id = $1 AND id = $2
        RETURNING *
      `,
      [businessId, serviceId]
    );

    return result.rows[0] ? mapService(result.rows[0]) : null;
  }
}

function mapService(row: ServiceRow): BusinessService {
  return {
    active: row.active,
    businessId: row.business_id,
    createdAt: row.created_at,
    description: row.description,
    durationMinutes: row.duration_minutes,
    id: row.id,
    name: row.name,
    price: Number(row.price),
    updatedAt: row.updated_at
  };
}
