import type { Business } from "./business.repository";

export interface PublishReadiness {
  canPublish: boolean;
  missingSteps: string[];
  requirements: {
    hasCity: boolean;
    hasService: boolean;
    hasStaff: boolean;
  };
  status: Business["status"];
}

export function buildPublishReadiness(input: {
  activeServiceCount: number;
  activeStaffCount: number;
  business: Business;
}): PublishReadiness {
  const hasCity = Boolean(input.business.city?.trim());
  const hasService = input.activeServiceCount > 0;
  const hasStaff = input.activeStaffCount > 0;
  const missingSteps: string[] = [];

  if (!hasService) {
    missingSteps.push("Add at least one service");
  }

  if (!hasStaff) {
    missingSteps.push("Add at least one staff member");
  }

  if (!hasCity) {
    missingSteps.push("Add a city so customers can find you");
  }

  return {
    canPublish: input.business.status === "PENDING_ONBOARDING" && hasCity && hasService && hasStaff,
    missingSteps,
    requirements: {
      hasCity,
      hasService,
      hasStaff
    },
    status: input.business.status
  };
}
