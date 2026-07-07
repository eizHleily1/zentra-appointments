import { Pressable, Text, View } from "react-native";
import { formatAppointmentStatus, formatAppointmentTimeRange } from "../lib/formatters";
import { styles } from "../lib/styles";

export interface ConsumerAppointmentView {
  businessAddress: string | null;
  businessCity: string | null;
  businessId: string;
  businessName: string;
  businessTimezone: string;
  clientDisplayName: string;
  endsAt: string;
  id: string;
  serviceName: string;
  servicePrice: number | null;
  staffDisplayName: string;
  startsAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
}

export function ConsumerAppointmentCard({
  appointment,
  onPress
}: {
  appointment: ConsumerAppointmentView;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.appointmentCardHeader}>
        <Text style={styles.cardTitle}>{appointment.businessName}</Text>
        <View
          style={[
            styles.statusBadge,
            appointment.status === "BOOKED" && styles.statusBadgeBooked,
            appointment.status === "COMPLETED" && styles.statusBadgeCompleted,
            appointment.status === "CANCELLED" && styles.statusBadgeCancelled
          ]}
        >
          <Text style={styles.statusBadgeText}>{formatAppointmentStatus(appointment.status)}</Text>
        </View>
      </View>
      <Text style={styles.appointmentTime}>
        {formatAppointmentTimeRange(appointment.startsAt, appointment.endsAt, appointment.businessTimezone)}
      </Text>
      <Text style={styles.appointmentMeta}>
        {appointment.serviceName} · {appointment.staffDisplayName}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.appointmentCard}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={styles.appointmentCard}>
      {content}
    </Pressable>
  );
}
