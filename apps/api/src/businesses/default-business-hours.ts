import { randomUUID } from "node:crypto";
import type { UpsertBusinessHourInput } from "./business-hours.repository";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function createDefaultBusinessHours(businessId: string): UpsertBusinessHourInput[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const isClosed = dayOfWeek === 5 || dayOfWeek === 6;

    return {
      businessId,
      closeTime: isClosed ? null : "17:00",
      dayOfWeek,
      id: randomUUID(),
      isClosed,
      openTime: isClosed ? null : "09:00"
    };
  });
}
