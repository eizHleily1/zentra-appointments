import { DAY_NAMES } from "./constants";
import type { BusinessHour } from "./types";

export function formatBusinessHoursSummary(businessHours: BusinessHour[]): string {
  const openDays = businessHours.filter((hour) => !hour.isClosed && hour.openTime && hour.closeTime);

  if (openDays.length === 0) {
    return "Closed";
  }

  const first = openDays[0];
  const uniform = openDays.every(
    (hour) => hour.openTime === first.openTime && hour.closeTime === first.closeTime
  );

  if (uniform && openDays.length >= 5) {
    return `${DAY_NAMES[first.dayOfWeek].slice(0, 3)}–${DAY_NAMES[openDays[openDays.length - 1].dayOfWeek].slice(0, 3)} ${first.openTime}–${first.closeTime}`;
  }

  return openDays
    .map((hour) => `${DAY_NAMES[hour.dayOfWeek].slice(0, 3)} ${hour.openTime}–${hour.closeTime}`)
    .join(", ");
}
