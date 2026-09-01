import { Injectable } from "@nestjs/common";
import { DatabaseService, type DatabaseTransactionClient } from "../database/database.service";
import type {
  AuthAccount,
  AuthRefreshToken,
  AuthRepository,
  CreateAuthAccountInput,
  CreateRefreshTokenInput,
  RotatePresentedRefreshTokenInput,
  RotatePresentedRefreshTokenResult
} from "./auth.repository";

interface AuthAccountRow {
  created_at: Date;
  email: string;
  id: string;
  password_hash: string;
  status: AuthAccount["status"];
  updated_at: Date;
}

interface AuthRefreshTokenRow {
  account_id: string;
  created_at: Date;
  expires_at: Date;
  id: string;
  replaced_by_token_id: string | null;
  revoked_at: Date | null;
  token_hash: string;
}

@Injectable()
export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createAccount(input: CreateAuthAccountInput): Promise<AuthAccount> {
    const result = await this.databaseService.query<AuthAccountRow>(
      `
        INSERT INTO users (id, email, password_hash, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [input.id, input.email, input.passwordHash, input.status]
    );

    return mapAccount(result.rows[0]);
  }

  async createRefreshToken(input: CreateRefreshTokenInput): Promise<AuthRefreshToken> {
    const result = await this.databaseService.query<AuthRefreshTokenRow>(
      `
        INSERT INTO auth_refresh_tokens (id, account_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [input.id, input.accountId, input.tokenHash, input.expiresAt]
    );

    return mapRefreshToken(result.rows[0]);
  }

  async findAccountByEmail(email: string): Promise<AuthAccount | null> {
    const result = await this.databaseService.query<AuthAccountRow>(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async findAccountById(id: string): Promise<AuthAccount | null> {
    const result = await this.databaseService.query<AuthAccountRow>(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [id]
    );

    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshToken | null> {
    const result = await this.databaseService.query<AuthRefreshTokenRow>(
      "SELECT * FROM auth_refresh_tokens WHERE token_hash = $1 LIMIT 1",
      [tokenHash]
    );

    return result.rows[0] ? mapRefreshToken(result.rows[0]) : null;
  }

  async revokeRefreshToken(id: string, replacedByTokenId?: string): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = COALESCE(revoked_at, now()),
            replaced_by_token_id = COALESCE(replaced_by_token_id, $2)
        WHERE id = $1
      `,
      [id, replacedByTokenId ?? null]
    );
  }

  async revokeRefreshTokensForAccount(accountId: string): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = COALESCE(revoked_at, now())
        WHERE account_id = $1
      `,
      [accountId]
    );
  }

  async rotatePresentedRefreshToken(
    input: RotatePresentedRefreshTokenInput
  ): Promise<RotatePresentedRefreshTokenResult> {
    return this.databaseService.transaction(async (client) => {
      const lockedResult = await client.query<AuthRefreshTokenRow>(
        "SELECT * FROM auth_refresh_tokens WHERE token_hash = $1 LIMIT 1 FOR UPDATE",
        [input.presentedTokenHash]
      );
      const presented = lockedResult.rows[0];

      if (!presented) {
        return { type: "not_found" };
      }

      if (presented.revoked_at) {
        await revokeAccountRefreshTokens(client, presented.account_id);
        return { type: "reuse_detected" };
      }

      if (presented.expires_at.getTime() <= Date.now()) {
        await client.query(
          `
            UPDATE auth_refresh_tokens
            SET revoked_at = COALESCE(revoked_at, now())
            WHERE id = $1
          `,
          [presented.id]
        );
        return { type: "expired" };
      }

      const accountResult = await client.query<AuthAccountRow>(
        "SELECT * FROM users WHERE id = $1 LIMIT 1 FOR UPDATE",
        [presented.account_id]
      );
      const accountRow = accountResult.rows[0];

      if (!accountRow || accountRow.status !== "ACTIVE") {
        await revokeAccountRefreshTokens(client, presented.account_id);
        return { type: "account_inactive" };
      }

      await client.query(
        `
          INSERT INTO auth_refresh_tokens (id, account_id, token_hash, expires_at)
          VALUES ($1, $2, $3, $4)
        `,
        [input.replacement.id, presented.account_id, input.replacement.tokenHash, input.replacement.expiresAt]
      );

      const revokePresented = await client.query(
        `
          UPDATE auth_refresh_tokens
          SET revoked_at = now(),
              replaced_by_token_id = $2
          WHERE id = $1 AND revoked_at IS NULL
        `,
        [presented.id, input.replacement.id]
      );

      if (revokePresented.rowCount !== 1) {
        await revokeAccountRefreshTokens(client, presented.account_id);
        return { type: "reuse_detected" };
      }

      return { type: "rotated", account: mapAccount(accountRow) };
    });
  }
}

async function revokeAccountRefreshTokens(client: DatabaseTransactionClient, accountId: string): Promise<void> {
  await client.query(
    `
      UPDATE auth_refresh_tokens
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE account_id = $1
    `,
    [accountId]
  );
}

function mapAccount(row: AuthAccountRow): AuthAccount {
  return {
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    passwordHash: row.password_hash,
    status: row.status,
    updatedAt: row.updated_at
  };
}

function mapRefreshToken(row: AuthRefreshTokenRow): AuthRefreshToken {
  return {
    accountId: row.account_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    replacedByTokenId: row.replaced_by_token_id,
    revokedAt: row.revoked_at,
    tokenHash: row.token_hash
  };
}
