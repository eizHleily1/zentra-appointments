import { ConfigService } from "@nestjs/config";
import { HttpException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AppConfig } from "../config/environment";
import { BookingRateLimitGuard } from "./booking-rate-limit.guard";

describe("BookingRateLimitGuard", () => {
  it("keys buckets on the connection address and ignores x-forwarded-for", () => {
    const guard = new BookingRateLimitGuard(configService(2, 60));

    expect(guard.canActivate(httpContext({ ip: "127.0.0.1", forwardedFor: "198.51.100.1" }))).toBe(true);
    expect(guard.canActivate(httpContext({ ip: "127.0.0.1", forwardedFor: "198.51.100.2" }))).toBe(true);

    expect(() => guard.canActivate(httpContext({ ip: "127.0.0.1", forwardedFor: "203.0.113.1" }))).toThrow(
      HttpException
    );

    expect(guard.canActivate(httpContext({ ip: "10.0.0.8", forwardedFor: "203.0.113.1" }))).toBe(true);
  });
});

function configService(max: number, ttlSeconds: number): ConfigService<AppConfig, true> {
  return {
    get(key: "GUEST_BOOKING_RATE_LIMIT_MAX" | "GUEST_BOOKING_RATE_LIMIT_TTL_SECONDS") {
      return key === "GUEST_BOOKING_RATE_LIMIT_MAX" ? max : ttlSeconds;
    }
  } as ConfigService<AppConfig, true>;
}

function httpContext(input: { forwardedFor: string; ip: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { "x-forwarded-for": input.forwardedFor },
        ip: input.ip,
        socket: { remoteAddress: input.ip }
      })
    })
  } as ExecutionContext;
}
