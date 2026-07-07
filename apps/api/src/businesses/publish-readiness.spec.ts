import { buildPublishReadiness } from "./publish-readiness";

describe("buildPublishReadiness", () => {
  it("requires services, staff, and city before publishing", () => {
    const readiness = buildPublishReadiness({
      activeServiceCount: 0,
      activeStaffCount: 0,
      business: {
        address: null,
        bookingIntervalMinutes: 15,
        businessType: "BARBER",
        city: null,
        createdAt: new Date(),
        id: "business-1",
        initialOwnerUserId: "owner-1",
        name: "Barber",
        status: "PENDING_ONBOARDING",
        timezone: "Asia/Amman",
        updatedAt: new Date()
      }
    });

    expect(readiness.canPublish).toBe(false);
    expect(readiness.missingSteps).toEqual([
      "Add at least one service",
      "Add at least one staff member",
      "Add a city so customers can find you"
    ]);
  });
});
