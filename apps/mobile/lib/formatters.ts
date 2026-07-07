import { BUSINESS_TYPE_LABELS } from "./constants";
import type { Appointment } from "./types";

export function formatServicePriceDisplay(price: number | null | undefined): string | null {
  if (price === null || price === undefined || price === 0) {
    return null;
  }

  return `₪${price}`;
}

export function formatServicePriceLabel(price: number | null | undefined): string | null {
  if (price === null || price === undefined || price === 0) {
    return null;
  }

  return String(price);
}

export function formatBusinessLocation(
  city: string | null | undefined,
  address: string | null | undefined
): string | null {
  const normalizedCity = city?.trim();
  const normalizedAddress = address?.trim();

  if (normalizedCity && normalizedAddress) {
    return `${normalizedCity} · ${normalizedAddress}`;
  }

  if (normalizedCity) {
    return normalizedCity;
  }

  if (normalizedAddress) {
    return normalizedAddress;
  }

  return null;
}

export function formatBusinessType(businessType: string): string {
  return BUSINESS_TYPE_LABELS[businessType] ?? businessType.replaceAll("_", " ");
}

export function formatBusinessStatus(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "DEACTIVATED":
      return "Deactivated";
    case "PENDING_ONBOARDING":
      return "Finish setup";
    default:
      return status.replaceAll("_", " ");
  }
}

export function formatClientPhoneLabel(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber || phoneNumber.trim().length === 0) {
    return null;
  }

  return phoneNumber.trim();
}

export function formatAppointmentStatus(status: Appointment["status"]): string {
  switch (status) {
    case "BOOKED":
      return "Booked";
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
  }
}

export function formatAppointmentTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short"
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });

  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

export function formatAppointmentTimeOnly(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });

  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}

export function formatTodayHeading(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
    year: "numeric"
  }).format(now);
}
