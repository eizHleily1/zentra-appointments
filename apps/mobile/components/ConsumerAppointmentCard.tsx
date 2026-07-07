import { StyleSheet, Text, View } from "react-native";
import { formatAppointmentStatus, formatAppointmentTimeRange } from "../lib/formatters";

export interface ConsumerAppointmentView {
  businessName: string;
  businessTimezone: string;
  endsAt: string;
  id: string;
  serviceName: string;
  staffDisplayName: string;
  startsAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
}

export function ConsumerAppointmentCard({ appointment }: { appointment: ConsumerAppointmentView }) {
  return (
    <View style={styles.appointmentCard}>
      <Text style={styles.businessName}>{appointment.businessName}</Text>
      <Text style={styles.time}>
        {formatAppointmentTimeRange(appointment.startsAt, appointment.endsAt, appointment.businessTimezone)}
      </Text>
      <Text style={styles.meta}>
        {appointment.serviceName} · {appointment.staffDisplayName}
      </Text>
      <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>{formatAppointmentStatus(appointment.status)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appointmentCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    padding: 14
  },
  businessName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700"
  },
  meta: {
    color: "#64748b",
    marginTop: 4
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusBadgeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "600"
  },
  time: {
    color: "#334155",
    marginTop: 4
  }
});
