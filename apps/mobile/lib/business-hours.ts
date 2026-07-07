import { DAY_NAMES } from "./constants";
import type { BusinessHour } from "./types";

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 0,
  Thu: 4,
  Tue: 2,
  Wed: 3
};

export function getDayOfWeekInTimeZone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return WEEKDAY_TO_INDEX[weekday] ?? 0;
}

function getMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone
  }).formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return Number(values.hour) * 60 + Number(values.minute);
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatBusinessOpenStatus(
  businessHours: BusinessHour[],
  timeZone: string,
  now = new Date()
): string {
  const dayOfWeek = getDayOfWeekInTimeZone(now, timeZone);
  const today = businessHours.find((hour) => hour.dayOfWeek === dayOfWeek);
  const hoursSummary = formatBusinessHoursSummary(businessHours);

  if (!today || today.isClosed || !today.openTime || !today.closeTime) {
    return `Closed today · ${hoursSummary}`;
  }

  const currentMinutes = getMinutesInTimeZone(now, timeZone);
  const openMinutes = parseTimeToMinutes(today.openTime);
  const closeMinutes = parseTimeToMinutes(today.closeTime);

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return `Open now · Closes ${formatTimeLabel(today.closeTime)}`;
  }

  if (currentMinutes < openMinutes) {
    return `Closed now · Opens ${formatTimeLabel(today.openTime)} · ${hoursSummary}`;
  }

  return `Closed today · ${hoursSummary}`;
}

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
