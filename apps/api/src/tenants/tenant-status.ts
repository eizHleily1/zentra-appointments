export const TENANT_STATUSES = ["PENDING_ONBOARDING", "ACTIVE", "DEACTIVATED"] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];
