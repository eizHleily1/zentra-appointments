import type { PublicBusinessProfile } from "./types";

export function isBusinessBookable(
  business: Pick<PublicBusinessProfile, "isBookable" | "services" | "staff">
): boolean {
  if (business.isBookable !== undefined) {
    return business.isBookable;
  }

  return business.services.length > 0 && business.staff.length > 0;
}

export function getBookingUnavailableMessage(
  business: Pick<PublicBusinessProfile, "services" | "staff">
): string {
  const hasServices = business.services.length > 0;
  const hasStaff = business.staff.length > 0;

  if (!hasServices && !hasStaff) {
    return "This business has not set up services or staff yet. Check back later.";
  }

  if (!hasServices) {
    return "This business has not added any bookable services yet. Check back later.";
  }

  return "This business has not added any staff yet. Check back later.";
}

export function getBusinessInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "?";
}
