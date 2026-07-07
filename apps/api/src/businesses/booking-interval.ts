export const ALLOWED_BOOKING_INTERVAL_MINUTES = [5, 10, 15, 20, 30, 60] as const;

export type BookingIntervalMinutes = (typeof ALLOWED_BOOKING_INTERVAL_MINUTES)[number];

export const DEFAULT_BOOKING_INTERVAL_MINUTES: BookingIntervalMinutes = 15;

export function isAllowedBookingIntervalMinutes(value: number): value is BookingIntervalMinutes {
  return ALLOWED_BOOKING_INTERVAL_MINUTES.includes(value as BookingIntervalMinutes);
}
