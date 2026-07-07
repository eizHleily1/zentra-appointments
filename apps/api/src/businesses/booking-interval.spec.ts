import {
  ALLOWED_BOOKING_INTERVAL_MINUTES,
  DEFAULT_BOOKING_INTERVAL_MINUTES,
  isAllowedBookingIntervalMinutes
} from "./booking-interval";

describe("booking-interval", () => {
  it("defaults to 15 minutes per product handbook", () => {
    expect(DEFAULT_BOOKING_INTERVAL_MINUTES).toBe(15);
  });

  it("allows only handbook whitelist values", () => {
    expect(ALLOWED_BOOKING_INTERVAL_MINUTES).toEqual([5, 10, 15, 20, 30, 60]);
    expect(isAllowedBookingIntervalMinutes(15)).toBe(true);
    expect(isAllowedBookingIntervalMinutes(7)).toBe(false);
  });
});
