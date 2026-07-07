import {
  filterPastConsumerAppointments,
  filterUpcomingConsumerAppointments,
  formatAppointmentDayHeading,
  groupAppointmentsByDay
} from "./schedule";

describe("schedule", () => {
  const sampleAppointments = [
    {
      businessAddress: null,
      businessCity: "Amman",
      businessId: "business-1",
      businessName: "Prime Barber",
      businessTimezone: "Asia/Amman",
      clientDisplayName: "Maria",
      endsAt: "2030-07-03T08:30:00.000Z",
      id: "00000000-0000-4000-8000-000000000011",
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Sam",
      startsAt: "2030-07-03T08:00:00.000Z",
      status: "BOOKED" as const
    },
    {
      businessAddress: null,
      businessCity: "Amman",
      businessId: "business-1",
      businessName: "Prime Barber",
      businessTimezone: "Asia/Amman",
      clientDisplayName: "Maria",
      endsAt: "2030-07-02T09:30:00.000Z",
      id: "00000000-0000-4000-8000-000000000012",
      serviceName: "Beard trim",
      servicePrice: null,
      staffDisplayName: "Sam",
      startsAt: "2030-07-02T09:00:00.000Z",
      status: "BOOKED" as const
    }
  ];

  it("groups upcoming appointments by day in chronological order", () => {
    const groups = groupAppointmentsByDay(sampleAppointments);

    expect(groups).toHaveLength(2);
    expect(groups[0].appointments[0].serviceName).toBe("Beard trim");
    expect(groups[1].appointments[0].serviceName).toBe("Haircut");
    expect(formatAppointmentDayHeading(groups[0].appointments[0].startsAt, groups[0].timeZone)).not.toMatch(/2030-07-02T/);
  });

  it("filters to upcoming booked appointments only", () => {
    const upcoming = filterUpcomingConsumerAppointments([
      ...sampleAppointments,
      {
        ...sampleAppointments[0],
        endsAt: "2020-01-01T08:30:00.000Z",
        id: "00000000-0000-4000-8000-000000000013",
        startsAt: "2020-01-01T08:00:00.000Z",
        status: "COMPLETED"
      }
    ]);

    expect(upcoming).toHaveLength(2);
    expect(upcoming.every((appointment) => appointment.status === "BOOKED")).toBe(true);
  });

  it("splits past appointments from upcoming", () => {
    const completed = {
      ...sampleAppointments[0],
      endsAt: "2020-01-01T08:30:00.000Z",
      id: "00000000-0000-4000-8000-000000000013",
      startsAt: "2020-01-01T08:00:00.000Z",
      status: "COMPLETED" as const
    };
    const cancelled = {
      ...sampleAppointments[1],
      id: "00000000-0000-4000-8000-000000000014",
      status: "CANCELLED" as const
    };
    const all = [...sampleAppointments, completed, cancelled];
    const upcoming = filterUpcomingConsumerAppointments(all);
    const past = filterPastConsumerAppointments(all);

    expect(upcoming).toHaveLength(2);
    expect(past).toHaveLength(2);
    expect(past.some((appointment) => appointment.status === "COMPLETED")).toBe(true);
    expect(past.some((appointment) => appointment.status === "CANCELLED")).toBe(true);
    expect(groupAppointmentsByDay(past, "desc")[0].appointments[0].status).toBe("CANCELLED");
  });
});
