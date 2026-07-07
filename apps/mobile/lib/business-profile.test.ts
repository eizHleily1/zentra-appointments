import { getBookingUnavailableMessage, getBusinessInitial, isBusinessBookable } from "./business-profile";

describe("business-profile", () => {
  const bookableBusiness = {
    isBookable: true,
    services: [{ description: "", durationMinutes: 30, id: "service-1", name: "Haircut", price: 15 }],
    staff: [{ displayName: "Alex", id: "staff-1" }]
  };

  it("detects when a business is bookable", () => {
    expect(isBusinessBookable(bookableBusiness)).toBe(true);
  });

  it("detects when services or staff are missing", () => {
    expect(isBusinessBookable({ ...bookableBusiness, isBookable: false, services: [] })).toBe(false);
    expect(isBusinessBookable({ ...bookableBusiness, isBookable: undefined, staff: [] })).toBe(false);
  });

  it("returns friendly booking unavailable messages", () => {
    expect(getBookingUnavailableMessage({ services: [], staff: [] })).toContain("services or staff");
    expect(getBookingUnavailableMessage({ services: [], staff: bookableBusiness.staff })).toContain("services");
    expect(getBookingUnavailableMessage({ services: bookableBusiness.services, staff: [] })).toContain("staff");
  });

  it("creates a business initial placeholder", () => {
    expect(getBusinessInitial("Downtown Barber")).toBe("D");
  });
});
