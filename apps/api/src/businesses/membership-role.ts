export const MEMBERSHIP_ROLES = ["OWNER", "STAFF", "CLIENT"] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
