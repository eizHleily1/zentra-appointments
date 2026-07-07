import type { Appointment } from "./appointment.repository";

export interface AvailableSlot {
  endTime: string;
  label: string;
  startTime: string;
}

import { DEFAULT_BOOKING_INTERVAL_MINUTES } from "../businesses/booking-interval";

export function appointmentsOverlap(existingStart: Date, existingEnd: Date, newStart: Date, newEnd: Date): boolean {
  return existingStart.getTime() < newEnd.getTime() && existingEnd.getTime() > newStart.getTime();
}

export function appointmentBlocksScheduling(appointment: Appointment, now: Date): boolean {
  if (appointment.status === "CANCELLED") {
    return false;
  }

  if (appointment.status === "BOOKED") {
    return true;
  }

  return appointment.startsAt.getTime() <= now.getTime();
}

export function computeAppointmentEndTime(startTime: Date, durationMinutes: number): Date {
  return new Date(startTime.getTime() + durationMinutes * 60_000);
}

export function getDayOfWeekForDate(date: string, timeZone: string): number {
  const utcDate = zonedLocalToUtc(`${date}T12:00:00`, timeZone);

  return getZonedDayOfWeek(utcDate, timeZone);
}

export function getZonedDayOfWeek(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const dayMap: Record<string, number> = {
    Fri: 5,
    Mon: 1,
    Sat: 6,
    Sun: 0,
    Thu: 4,
    Tue: 2,
    Wed: 3
  };

  return dayMap[weekday] ?? 0;
}

export function generateAvailableSlots(input: {
  bookingIntervalMinutes?: number;
  closeTime: string;
  date: string;
  durationMinutes: number;
  existingAppointments: Appointment[];
  now: Date;
  openTime: string;
  timeZone: string;
}): AvailableSlot[] {
  const openUtc = zonedLocalToUtc(`${input.date}T${input.openTime}:00`, input.timeZone);
  const closeUtc = zonedLocalToUtc(`${input.date}T${input.closeTime}:00`, input.timeZone);
  const slots: AvailableSlot[] = [];
  const durationMs = input.durationMinutes * 60_000;
  const intervalMs = (input.bookingIntervalMinutes ?? DEFAULT_BOOKING_INTERVAL_MINUTES) * 60_000;

  for (let candidateStartMs = openUtc.getTime(); candidateStartMs + durationMs <= closeUtc.getTime(); candidateStartMs += intervalMs) {
    const candidateStart = new Date(candidateStartMs);
    const candidateEnd = new Date(candidateStartMs + durationMs);

    if (candidateStart.getTime() < input.now.getTime()) {
      continue;
    }

    const overlapsExisting = input.existingAppointments.some((appointment) => {
      if (!appointmentBlocksScheduling(appointment, input.now)) {
        return false;
      }

      return appointmentsOverlap(appointment.startsAt, appointment.endsAt, candidateStart, candidateEnd);
    });

    if (overlapsExisting) {
      continue;
    }

    slots.push({
      endTime: candidateEnd.toISOString(),
      label: formatSlotLabel(candidateStart, candidateEnd, input.timeZone),
      startTime: candidateStart.toISOString()
    });
  }

  return slots;
}

export function isStartTimeWithinBusinessHours(input: {
  closeTime: string;
  date: string;
  durationMinutes: number;
  openTime: string;
  startTime: Date;
  timeZone: string;
}): boolean {
  const openUtc = zonedLocalToUtc(`${input.date}T${input.openTime}:00`, input.timeZone);
  const closeUtc = zonedLocalToUtc(`${input.date}T${input.closeTime}:00`, input.timeZone);
  const endTime = computeAppointmentEndTime(input.startTime, input.durationMinutes);

  return input.startTime.getTime() >= openUtc.getTime() && endTime.getTime() <= closeUtc.getTime();
}

export function zonedLocalToUtc(localDateTime: string, timeZone: string): Date {
  const [datePart, timePart = "00:00:00"] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000;
  }

  return new Date(utcMs);
}

function formatSlotLabel(startTime: Date, _endTime: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(startTime);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    // hourCycle h23 avoids ICU formatting midnight as "24", which would skew the offset by a day
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return (asUtc - date.getTime()) / 60_000;
}
