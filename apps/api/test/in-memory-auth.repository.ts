import type {
  AuthAccount,
  AuthRefreshToken,
  AuthRepository,
  CreateAuthAccountInput,
  CreateRefreshTokenInput
} from "../src/auth/auth.repository";

export class InMemoryAuthRepository implements AuthRepository {
  private readonly accounts = new Map<string, AuthAccount>();
  private readonly refreshTokens = new Map<string, AuthRefreshToken>();

  async createAccount(input: CreateAuthAccountInput): Promise<AuthAccount> {
    const now = new Date();
    const account: AuthAccount = {
      createdAt: now,
      email: input.email,
      id: input.id,
      passwordHash: input.passwordHash,
      status: input.status,
      updatedAt: now
    };

    this.accounts.set(account.id, account);
    return account;
  }

  async createRefreshToken(input: CreateRefreshTokenInput): Promise<AuthRefreshToken> {
    const token: AuthRefreshToken = {
      accountId: input.accountId,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
      id: input.id,
      replacedByTokenId: null,
      revokedAt: null,
      tokenHash: input.tokenHash
    };

    this.refreshTokens.set(token.id, token);
    return token;
  }

  async findAccountByEmail(email: string): Promise<AuthAccount | null> {
    return Array.from(this.accounts.values()).find((account) => account.email === email) ?? null;
  }

  async findAccountById(id: string): Promise<AuthAccount | null> {
    return this.accounts.get(id) ?? null;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshToken | null> {
    return Array.from(this.refreshTokens.values()).find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async revokeRefreshToken(id: string, replacedByTokenId?: string): Promise<void> {
    const token = this.refreshTokens.get(id);

    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      token.replacedByTokenId = replacedByTokenId ?? null;
    }
  }

  async revokeRefreshTokensForAccount(accountId: string): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.accountId === accountId && !token.revokedAt) {
        token.revokedAt = new Date();
      }
    }
  }

  disableAccount(id: string): void {
    const account = this.accounts.get(id);

    if (account) {
      account.status = "DISABLED";
      account.updatedAt = new Date();
    }
  }

  getAccounts(): AuthAccount[] {
    return Array.from(this.accounts.values());
  }

  getRefreshTokens(): AuthRefreshToken[] {
    return Array.from(this.refreshTokens.values());
  }
}
