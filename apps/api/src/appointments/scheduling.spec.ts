import type { Appointment } from "./appointment.repository";
import {
  appointmentBlocksScheduling,
  appointmentsOverlap,
  computeAppointmentEndTime,
  generateAvailableSlots,
  isStartTimeWithinBusinessHours,
  zonedLocalToUtc
} from "./scheduling";

const TEST_DATE = "2030-07-02";

describe("scheduling", () => {
  it("computes appointment end time from service duration", () => {
    const startTime = new Date("2026-07-01T07:00:00.000Z");

    expect(computeAppointmentEndTime(startTime, 10).toISOString()).toBe("2026-07-01T07:10:00.000Z");
    expect(computeAppointmentEndTime(startTime, 30).toISOString()).toBe("2026-07-01T07:30:00.000Z");
  });

  it("detects overlapping appointments", () => {
    const existingStart = new Date("2026-07-01T10:00:00.000Z");
    const existingEnd = new Date("2026-07-01T10:30:00.000Z");
    const overlappingStart = new Date("2026-07-01T10:15:00.000Z");
    const overlappingEnd = new Date("2026-07-01T10:45:00.000Z");
    const nonOverlappingStart = new Date("2026-07-01T10:30:00.000Z");
    const nonOverlappingEnd = new Date("2026-07-01T11:00:00.000Z");

    expect(appointmentsOverlap(existingStart, existingEnd, overlappingStart, overlappingEnd)).toBe(true);
    expect(appointmentsOverlap(existingStart, existingEnd, nonOverlappingStart, nonOverlappingEnd)).toBe(false);
  });

  it("blocks cancelled appointments but not completed future appointments", () => {
    const now = new Date("2026-07-01T11:00:00.000Z");
    const cancelled: Appointment = {
      businessId: "business-1",
      clientDisplayName: "Jane Customer",
      clientId: "client-1",
      clientPhoneNumber: null,
      createdAt: now,
      endsAt: new Date("2026-07-01T10:30:00.000Z"),
      id: "appointment-1",
      serviceDurationMinutes: 30,
      serviceId: "service-1",
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff",
      staffMemberId: "staff-1",
      startsAt: new Date("2026-07-01T10:00:00.000Z"),
      status: "CANCELLED",
      updatedAt: now
    };
    const booked: Appointment = { ...cancelled, status: "BOOKED" };
    const completedPast: Appointment = { ...cancelled, status: "COMPLETED" };
    const completedFuture: Appointment = {
      ...cancelled,
      startsAt: new Date("2026-07-01T12:00:00.000Z"),
      endsAt: new Date("2026-07-01T12:30:00.000Z"),
      status: "COMPLETED"
    };

    expect(appointmentBlocksScheduling(cancelled, now)).toBe(false);
    expect(appointmentBlocksScheduling(booked, now)).toBe(true);
    expect(appointmentBlocksScheduling(completedPast, now)).toBe(true);
    expect(appointmentBlocksScheduling(completedFuture, now)).toBe(false);
  });

  it("generates slots inside business hours and excludes overlapping booked appointments", () => {
    const now = new Date("2030-07-01T05:00:00.000Z");
    const booked: Appointment = {
      businessId: "business-1",
      clientDisplayName: "Jane Customer",
      clientId: "client-1",
      clientPhoneNumber: null,
      createdAt: now,
      endsAt: zonedLocalToUtc(`${TEST_DATE}T10:30:00`, "Asia/Amman"),
      id: "appointment-1",
      serviceDurationMinutes: 30,
      serviceId: "service-1",
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff",
      staffMemberId: "staff-1",
      startsAt: zonedLocalToUtc(`${TEST_DATE}T10:00:00`, "Asia/Amman"),
      status: "BOOKED",
      updatedAt: now
    };

    const slots = generateAvailableSlots({
      closeTime: "17:00",
      date: TEST_DATE,
      durationMinutes: 30,
      existingAppointments: [booked],
      now,
      openTime: "09:00",
      timeZone: "Asia/Amman"
    });

    expect(slots.some((slot) => slot.startTime === booked.startsAt.toISOString())).toBe(false);
    expect(slots.some((slot) => slot.startTime === booked.endsAt.toISOString())).toBe(true);
  });

  it("validates start times against business hours", () => {
    expect(
      isStartTimeWithinBusinessHours({
        closeTime: "17:00",
        date: TEST_DATE,
        durationMinutes: 30,
        openTime: "09:00",
        startTime: zonedLocalToUtc(`${TEST_DATE}T09:00:00`, "Asia/Amman"),
        timeZone: "Asia/Amman"
      })
    ).toBe(true);
  });
});
