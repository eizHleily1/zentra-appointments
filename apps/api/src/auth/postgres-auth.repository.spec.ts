import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { validateEnvironment } from "../config/environment";
import { DatabaseService } from "../database/database.service";
import { PostgresAuthRepository } from "./postgres-auth.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev";

describe("PostgresAuthRepository refresh-token rotation", () => {
  let databaseService: DatabaseService;
  let repository: PostgresAuthRepository;
  let observerPool: Pool;
  const createdAccountIds: string[] = [];

  beforeAll(async () => {
    observerPool = new Pool({ connectionString: databaseUrl });
    await observerPool.query(readFileSync(join(__dirname, "../../db/phase-2-auth.sql"), "utf8"));

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          validate: validateEnvironment
        })
      ],
      providers: [DatabaseService, PostgresAuthRepository]
    }).compile();

    databaseService = moduleRef.get(DatabaseService);
    repository = moduleRef.get(PostgresAuthRepository);
  });

  afterEach(async () => {
    while (createdAccountIds.length > 0) {
      const accountId = createdAccountIds.pop();

      if (accountId) {
        await databaseService.query("DELETE FROM users WHERE id = $1", [accountId]);
      }
    }
  });

  afterAll(async () => {
    await databaseService?.onModuleDestroy();
    await observerPool?.end();
  });

  it("serializes overlapping rotations of one refresh token so only one successor is inserted", async () => {
    const { token: presented } = await seedActiveRefreshToken();
    const firstReplacement = replacementInput();
    const secondReplacement = replacementInput();

    const [firstResult, secondResult] = await Promise.all([
      repository.rotatePresentedRefreshToken({
        presentedTokenHash: presented.tokenHash,
        replacement: firstReplacement
      }),
      repository.rotatePresentedRefreshToken({
        presentedTokenHash: presented.tokenHash,
        replacement: secondReplacement
      })
    ]);

    const outcomes = [firstResult.type, secondResult.type];
    const tokens = await loadTokensForAccount(presented.accountId);
    const successorIds = tokens.filter((token) => token.id !== presented.id).map((token) => token.id);
    const presentedRow = tokens.find((token) => token.id === presented.id);

    expect(outcomes.filter((type) => type === "rotated")).toHaveLength(1);
    expect(outcomes).toContain("reuse_detected");
    expect(successorIds).toHaveLength(1);
    expect(tokens).toHaveLength(2);
    expect([firstReplacement.id, secondReplacement.id]).toContain(successorIds[0]);
    expect(presentedRow?.revokedAt).toBeInstanceOf(Date);
    expect(presentedRow?.replacedByTokenId).toBe(successorIds[0]);
  });

  it("blocks a second rotation on SELECT ... FOR UPDATE until the first lock on R1 is released", async () => {
    const { token: presented } = await seedActiveRefreshToken();
    const holder = await observerPool.connect();

    try {
      await holder.query("BEGIN");
      await holder.query("SELECT * FROM auth_refresh_tokens WHERE token_hash = $1 LIMIT 1 FOR UPDATE", [
        presented.tokenHash
      ]);

      const replacement = replacementInput();
      let rotationSettled = false;
      const rotationPromise = repository
        .rotatePresentedRefreshToken({
          presentedTokenHash: presented.tokenHash,
          replacement
        })
        .finally(() => {
          rotationSettled = true;
        });

      await waitUntil(async () => hasUngrantedRefreshTokenLock(holder), "rotation to wait on R1 FOR UPDATE");
      expect(rotationSettled).toBe(false);

      await holder.query("COMMIT");
      const result = await rotationPromise;

      expect(result.type).toBe("rotated");
      const tokens = await loadTokensForAccount(presented.accountId);
      expect(tokens.filter((token) => token.id !== presented.id)).toHaveLength(1);
    } finally {
      await holder.query("ROLLBACK");
      holder.release();
    }
  });

  async function seedActiveRefreshToken() {
    const account = await repository.createAccount({
      email: `rotate-lock-${randomUUID()}@example.com`,
      id: randomUUID(),
      passwordHash: "not-used-in-rotation-tests",
      status: "ACTIVE"
    });
    createdAccountIds.push(account.id);

    const token = await repository.createRefreshToken({
      accountId: account.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: randomUUID(),
      tokenHash: `refresh-hash-${randomUUID()}`
    });

    return { account, token };
  }

  async function loadTokensForAccount(accountId: string) {
    const result = await databaseService.query<{
      id: string;
      replaced_by_token_id: string | null;
      revoked_at: Date | null;
    }>("SELECT id, replaced_by_token_id, revoked_at FROM auth_refresh_tokens WHERE account_id = $1", [accountId]);

    return result.rows.map((row) => ({
      id: row.id,
      replacedByTokenId: row.replaced_by_token_id,
      revokedAt: row.revoked_at
    }));
  }
});

function replacementInput() {
  return {
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    id: randomUUID(),
    tokenHash: `refresh-hash-${randomUUID()}`
  };
}

async function waitUntil(predicate: () => Promise<boolean>, label: string, timeoutMs = 3000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function hasUngrantedRefreshTokenLock(holder: PoolClient): Promise<boolean> {
  const result = await holder.query<{ n: number }>(
    `
      SELECT COUNT(*)::int AS n
      FROM pg_stat_activity activity
      WHERE pg_backend_pid() = ANY (pg_blocking_pids(activity.pid))
        AND activity.query ILIKE '%auth_refresh_tokens%FOR UPDATE%'
    `
  );

  return (result.rows[0]?.n ?? 0) > 0;
}
