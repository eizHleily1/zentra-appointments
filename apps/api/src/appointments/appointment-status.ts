export const APPOINTMENT_STATUSES = ["BOOKED", "CANCELLED", "COMPLETED"] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
