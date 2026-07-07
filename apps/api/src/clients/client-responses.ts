import type { Appointment } from "../appointments/appointment.repository";
import type { Client } from "./client.repository";

export interface ClientSummary extends Client {
  lastAppointmentAt: Date | null;
  totalAppointments: number;
}

export interface ClientDetailsResponse {
  appointments: Appointment[];
  client: Client;
}
