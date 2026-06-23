import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/environment";
import { AUTH_REPOSITORY, type AuthAccount, type AuthRepository } from "./auth.repository";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

interface IssuedTokenPair extends AuthTokenResponse {
  refreshTokenId: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService
  ) {}

  async register(email: string, password: string): Promise<AuthTokenResponse> {
    const normalizedEmail = normalizeEmail(email);
    this.assertPasswordMeetsPolicy(password);

    const existingAccount = await this.authRepository.findAccountByEmail(normalizedEmail);

    if (existingAccount) {
      throw new ConflictException("Registration could not be completed");
    }

    const account = await this.authRepository.createAccount({
      email: normalizedEmail,
      id: randomUUID(),
      passwordHash: await this.passwordService.hash(password),
      status: "ACTIVE"
    });

    return toAuthTokenResponse(await this.issueTokenPair(account));
  }

  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const account = await this.authRepository.findAccountByEmail(normalizeEmail(email));

    if (!account || account.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatches = await this.passwordService.verify(password, account.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return toAuthTokenResponse(await this.issueTokenPair(account));
  }

  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const storedToken = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (storedToken.revokedAt) {
      await this.authRepository.revokeRefreshTokensForAccount(storedToken.accountId);
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.authRepository.revokeRefreshToken(storedToken.id);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const account = await this.authRepository.findAccountById(storedToken.accountId);

    if (!account || account.status !== "ACTIVE") {
      await this.authRepository.revokeRefreshTokensForAccount(storedToken.accountId);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenPair = await this.issueTokenPair(account);
    await this.authRepository.revokeRefreshToken(storedToken.id, tokenPair.refreshTokenId);

    return toAuthTokenResponse(tokenPair);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const storedToken = await this.authRepository.findRefreshTokenByHash(this.tokenService.hashRefreshToken(refreshToken));

    if (storedToken && !storedToken.revokedAt) {
      await this.authRepository.revokeRefreshToken(storedToken.id);
    }

    return { success: true };
  }

  private async issueTokenPair(account: AuthAccount): Promise<IssuedTokenPair> {
    const refreshToken = this.tokenService.createRefreshToken();
    const refreshTokenId = randomUUID();

    await this.authRepository.createRefreshToken({
      accountId: account.id,
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
      id: refreshTokenId,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken)
    });

    return {
      accessToken: this.tokenService.signAccessToken({
        email: account.email,
        sub: account.id
      }),
      refreshToken,
      refreshTokenId,
      tokenType: "Bearer"
    };
  }

  private assertPasswordMeetsPolicy(password: string): void {
    const minLength = this.configService.get("PASSWORD_MIN_LENGTH", { infer: true });

    if (password.length < minLength) {
      throw new ConflictException("Registration could not be completed");
    }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthTokenResponse(tokenPair: IssuedTokenPair): AuthTokenResponse {
  return {
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    tokenType: tokenPair.tokenType
  };
}
