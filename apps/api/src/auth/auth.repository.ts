import type { AccountStatus } from "./account-status";

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

export interface AuthAccount {
  createdAt: Date;
  email: string;
  id: string;
  passwordHash: string;
  status: AccountStatus;
  updatedAt: Date;
}

export interface AuthRefreshToken {
  accountId: string;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  replacedByTokenId: string | null;
  revokedAt: Date | null;
  tokenHash: string;
}

export interface CreateAuthAccountInput {
  email: string;
  id: string;
  passwordHash: string;
  status: AccountStatus;
}

export interface CreateRefreshTokenInput {
  accountId: string;
  expiresAt: Date;
  id: string;
  tokenHash: string;
}

export interface AuthRepository {
  createAccount(input: CreateAuthAccountInput): Promise<AuthAccount>;
  createRefreshToken(input: CreateRefreshTokenInput): Promise<AuthRefreshToken>;
  findAccountByEmail(email: string): Promise<AuthAccount | null>;
  findAccountById(id: string): Promise<AuthAccount | null>;
  findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshToken | null>;
  revokeRefreshToken(id: string, replacedByTokenId?: string): Promise<void>;
  revokeRefreshTokensForAccount(accountId: string): Promise<void>;
}
