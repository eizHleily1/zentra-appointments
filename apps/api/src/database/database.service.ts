import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, QueryResult, QueryResultRow } from "pg";
import type { AppConfig } from "../config/environment";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.pool = new Pool({
      connectionString: configService.get("DATABASE_URL", { infer: true })
    });
  }

  query<Row extends QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
