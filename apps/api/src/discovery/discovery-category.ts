import type { BusinessType } from "../tenants/business-type";

export const DISCOVERY_CATEGORIES = [
  "BARBER",
  "BEAUTY",
  "DENTIST",
  "FITNESS",
  "CLINIC",
  "COACHING",
  "OTHER"
] as const;

export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_CATEGORY_BUSINESS_TYPES: Record<DiscoveryCategory, BusinessType[]> = {
  BARBER: ["BARBER"],
  BEAUTY: ["SALON", "NAIL_ARTIST"],
  DENTIST: ["CLINIC"],
  FITNESS: ["PERSONAL_TRAINER"],
  CLINIC: ["THERAPIST"],
  COACHING: ["COACH", "CONSULTANT"],
  OTHER: ["OTHER"]
};

export function isDiscoveryCategory(value: string): value is DiscoveryCategory {
  return DISCOVERY_CATEGORIES.includes(value as DiscoveryCategory);
}

export function resolveBusinessTypesForCategory(category: DiscoveryCategory): BusinessType[] {
  return DISCOVERY_CATEGORY_BUSINESS_TYPES[category];
}
