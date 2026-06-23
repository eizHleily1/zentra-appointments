export const BUSINESS_TYPES = [
  "BARBER",
  "SALON",
  "NAIL_ARTIST",
  "THERAPIST",
  "CLINIC",
  "COACH",
  "PERSONAL_TRAINER",
  "CONSULTANT",
  "OTHER"
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
