import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/environment";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RequestLike {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

type RateLimitMaxKey = {
  [Key in keyof AppConfig]: Key extends `${string}_RATE_LIMIT_MAX` ? Key : never;
}[keyof AppConfig];

type RateLimitTtlKey = {
  [Key in keyof AppConfig]: Key extends `${string}_RATE_LIMIT_TTL_SECONDS` ? Key : never;
}[keyof AppConfig];

/**
 * Builds an in-process per-caller rate limit guard. The bucket key is the connection
 * address only: `x-forwarded-for` is attacker-controlled unless the app configures
 * trusted proxies, which it does not.
 */
export function createIpRateLimitGuard(options: {
  maxKey: RateLimitMaxKey;
  message: string;
  ttlKey: RateLimitTtlKey;
}): Type<CanActivate> {
  @Injectable()
  class IpRateLimitGuard implements CanActivate {
    private readonly buckets = new Map<string, RateLimitBucket>();

    constructor(private readonly configService: ConfigService<AppConfig, true>) {}

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<RequestLike>();
      const now = Date.now();
      const max = this.configService.get(options.maxKey, { infer: true });
      const ttlMs = this.configService.get(options.ttlKey, { infer: true }) * 1000;
      const key = request.ip || request.socket?.remoteAddress || "unknown";
      const existing = this.buckets.get(key);

      if (!existing || existing.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + ttlMs });
        return true;
      }

      if (existing.count >= max) {
        throw new HttpException(options.message, HttpStatus.TOO_MANY_REQUESTS);
      }

      existing.count += 1;
      return true;
    }
  }

  return IpRateLimitGuard;
}
