import { SetMetadata } from "@nestjs/common";

export type AuthRateLimitType = "login" | "refresh" | "register";

export const AUTH_RATE_LIMIT_TYPE = "authRateLimitType";

export function AuthRateLimit(type: AuthRateLimitType) {
  return SetMetadata(AUTH_RATE_LIMIT_TYPE, type);
}
