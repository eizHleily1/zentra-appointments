import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
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

  async transaction<Result>(callback: (client: DatabaseTransactionClient) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(new DatabaseTransactionClient(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

export class DatabaseTransactionClient {
  constructor(private readonly client: PoolClient) {}

  query<Row extends QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<Row>> {
    return this.client.query<Row>(text, params);
  }
}
