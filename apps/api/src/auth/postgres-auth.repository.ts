import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type {
  AuthAccount,
  AuthRefreshToken,
  AuthRepository,
  CreateAuthAccountInput,
  CreateRefreshTokenInput
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
