export function formatServicePriceDisplay(price: number | null | undefined): string | null {
  if (price === null || price === undefined || price === 0) {
    return null;
  }

  return `₪${price}`;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  BARBER: "Barber Shop",
  CLINIC: "Clinic",
  COACHING: "Coaching",
  CONSULTANT: "Consulting",
  DENTIST: "Dentist",
  FITNESS: "Fitness",
  OTHER: "Other",
  SALON: "Beauty Salon"
};

export function formatBusinessType(businessType: string): string {
  return BUSINESS_TYPE_LABELS[businessType] ?? businessType.replaceAll("_", " ");
}

export function formatBusinessLocation(city: string | null | undefined, address: string | null | undefined): string | null {
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

export function formatAppointmentStatus(status: "BOOKED" | "CANCELLED" | "COMPLETED"): string {
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
