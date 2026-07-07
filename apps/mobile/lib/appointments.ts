import type { Appointment } from "./types";

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });
  const values: Record<string, string> = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function isAppointmentOnDate(appointment: Appointment, dateKey: string, timeZone: string): boolean {
  return getDateKeyInTimeZone(new Date(appointment.startsAt), timeZone) === dateKey;
}

export function sortAppointmentsChronologically(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
  );
}
