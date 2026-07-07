import { formatBusinessHoursSummary, formatBusinessOpenStatus } from "./business-hours";

describe("business-hours", () => {
  const businessHours = [
    { closeTime: "18:00", dayOfWeek: 0, id: "0", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 1, id: "1", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 2, id: "2", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 3, id: "3", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 4, id: "4", isClosed: false, openTime: "09:00" },
    { closeTime: null, dayOfWeek: 5, id: "5", isClosed: true, openTime: null },
    { closeTime: null, dayOfWeek: 6, id: "6", isClosed: true, openTime: null }
  ];

  it("summarizes uniform business hours", () => {
    expect(formatBusinessHoursSummary(businessHours)).toBe("Sun–Thu 09:00–18:00");
  });

  it("describes open status in human language", () => {
    const tuesdayMorning = new Date("2030-07-02T07:00:00.000Z");
    const status = formatBusinessOpenStatus(businessHours, "Asia/Amman", tuesdayMorning);

    expect(status).toMatch(/Open now|Closed now|Closed today/);
    expect(status).not.toMatch(/BARBER|00000000/);
  });
});
