import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import type { AppConfig } from "../config/environment";

export interface AccessTokenPayload {
  email: string;
  sub: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get("JWT_ACCESS_TOKEN_EXPIRES_IN", { infer: true }),
      secret: this.configService.get("JWT_ACCESS_TOKEN_SECRET", { infer: true })
    });
  }

  createRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  getRefreshTokenExpiresAt(now = new Date()): Date {
    const durationMs = parseDurationMs(this.configService.get("REFRESH_TOKEN_EXPIRES_IN", { infer: true }));
    return new Date(now.getTime() + durationMs);
  }
}

export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error("Duration must use s, m, h, or d suffix");
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000
  };

  return amount * multipliers[unit];
}
