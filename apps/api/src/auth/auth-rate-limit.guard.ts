import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { AppConfig } from "../config/environment";
import { AUTH_RATE_LIMIT_TYPE, type AuthRateLimitType } from "./auth-rate-limit.decorator";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const type = this.reflector.get<AuthRateLimitType>(AUTH_RATE_LIMIT_TYPE, context.getHandler());

    if (!type) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const now = Date.now();
    const max = this.getMax(type);
    const ttlMs = this.getTtlSeconds(type) * 1000;
    const key = `${type}:${this.getClientKey(request)}`;
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + ttlMs });
      return true;
    }

    if (existing.count >= max) {
      throw new HttpException("Too many authentication attempts", HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }

  private getClientKey(request: RequestLike): string {
    const forwardedFor = request.headers["x-forwarded-for"];
    const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return forwardedValue?.split(",")[0]?.trim() || request.ip || request.socket?.remoteAddress || "unknown";
  }

  private getMax(type: AuthRateLimitType): number {
    const keyByType = {
      login: "AUTH_LOGIN_RATE_LIMIT_MAX",
      refresh: "AUTH_REFRESH_RATE_LIMIT_MAX",
      register: "AUTH_REGISTER_RATE_LIMIT_MAX"
    } as const;

    return this.configService.get(keyByType[type], { infer: true });
  }

  private getTtlSeconds(type: AuthRateLimitType): number {
    const keyByType = {
      login: "AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS",
      refresh: "AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS",
      register: "AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS"
    } as const;

    return this.configService.get(keyByType[type], { infer: true });
  }
}
