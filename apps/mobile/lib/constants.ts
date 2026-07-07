import type { DiscoveryCategoryId } from "./types";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  BARBER: "Barber Shop",
  CLINIC: "Clinic",
  COACH: "Coaching",
  CONSULTANT: "Consulting",
  NAIL_ARTIST: "Nail Salon",
  OTHER: "Other",
  PERSONAL_TRAINER: "Personal Training",
  SALON: "Hair Salon",
  THERAPIST: "Therapy"
};

export const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABELS);

export const DISCOVERY_CATEGORY_OPTIONS: Array<{ id: DiscoveryCategoryId; label: string }> = [
  { id: "BARBER", label: "Barber" },
  { id: "BEAUTY", label: "Beauty" },
  { id: "DENTIST", label: "Dentist" },
  { id: "FITNESS", label: "Fitness" },
  { id: "CLINIC", label: "Clinic" },
  { id: "COACHING", label: "Coaching" },
  { id: "OTHER", label: "Other" }
];
