import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
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

@Injectable()
export class BookingRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const now = Date.now();
    const max = this.configService.get("GUEST_BOOKING_RATE_LIMIT_MAX", { infer: true });
    const ttlMs = this.configService.get("GUEST_BOOKING_RATE_LIMIT_TTL_SECONDS", { infer: true }) * 1000;
    const key = this.getClientKey(request);
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + ttlMs });
      return true;
    }

    if (existing.count >= max) {
      throw new HttpException("Too many booking attempts", HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }

  private getClientKey(request: RequestLike): string {
    return request.ip || request.socket?.remoteAddress || "unknown";
  }
}
