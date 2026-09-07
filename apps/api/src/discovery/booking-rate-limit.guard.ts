import { Injectable } from "@nestjs/common";
import { createIpRateLimitGuard } from "./ip-rate-limit.guard";

@Injectable()
export class BookingRateLimitGuard extends createIpRateLimitGuard({
  maxKey: "GUEST_BOOKING_RATE_LIMIT_MAX",
  message: "Too many booking attempts",
  ttlKey: "GUEST_BOOKING_RATE_LIMIT_TTL_SECONDS"
}) {}

@Injectable()
export class BookingVerificationRequestRateLimitGuard extends createIpRateLimitGuard({
  maxKey: "GUEST_BOOKING_VERIFICATION_REQUEST_RATE_LIMIT_MAX",
  message: "Too many verification code requests",
  ttlKey: "GUEST_BOOKING_VERIFICATION_REQUEST_RATE_LIMIT_TTL_SECONDS"
}) {}

@Injectable()
export class BookingVerificationCheckRateLimitGuard extends createIpRateLimitGuard({
  maxKey: "GUEST_BOOKING_VERIFICATION_CHECK_RATE_LIMIT_MAX",
  message: "Too many verification attempts",
  ttlKey: "GUEST_BOOKING_VERIFICATION_CHECK_RATE_LIMIT_TTL_SECONDS"
}) {}
