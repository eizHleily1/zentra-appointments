import type { ConsumerAppointmentView } from "../components/ConsumerAppointmentCard";
import { getDateKeyInTimeZone } from "./appointments";

export interface ScheduleDayGroup<T extends { businessTimezone: string; startsAt: string }> {
  appointments: T[];
  dateKey: string;
  timeZone: string;
}

export function isUpcomingConsumerAppointment(
  appointment: ConsumerAppointmentView,
  now = Date.now()
): boolean {
  return appointment.status === "BOOKED" && new Date(appointment.endsAt).getTime() > now;
}

export function filterUpcomingConsumerAppointments(appointments: ConsumerAppointmentView[]): ConsumerAppointmentView[] {
  return appointments.filter((appointment) => isUpcomingConsumerAppointment(appointment));
}

export function filterPastConsumerAppointments(appointments: ConsumerAppointmentView[]): ConsumerAppointmentView[] {
  return appointments.filter((appointment) => !isUpcomingConsumerAppointment(appointment));
}

export function groupAppointmentsByDay<T extends { businessTimezone: string; startsAt: string }>(
  appointments: T[],
  direction: "asc" | "desc" = "asc"
): ScheduleDayGroup<T>[] {
  const sorted = [...appointments].sort((left, right) => {
    const delta = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    return direction === "asc" ? delta : -delta;
  });
  const groups = new Map<string, ScheduleDayGroup<T>>();

  for (const appointment of sorted) {
    const dateKey = getDateKeyInTimeZone(new Date(appointment.startsAt), appointment.businessTimezone);
    const existing = groups.get(dateKey);

    if (existing) {
      existing.appointments.push(appointment);
      continue;
    }

    groups.set(dateKey, {
      appointments: [appointment],
      dateKey,
      timeZone: appointment.businessTimezone
    });
  }

  return Array.from(groups.values());
}

export function formatAppointmentDayHeading(startsAt: string, timeZone: string, now = new Date()): string {
  const dateKey = getDateKeyInTimeZone(new Date(startsAt), timeZone);
  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const tomorrowKey = getDateKeyInTimeZone(tomorrow, timeZone);

  if (dateKey === todayKey) {
    return "Today";
  }

  if (dateKey === tomorrowKey) {
    return "Tomorrow";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long"
  }).format(new Date(startsAt));
}

export function formatAppointmentDateOnly(startsAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
    year: "numeric"
  }).format(new Date(startsAt));
}
