import { Pressable, Text, View } from "react-native";
import {
  formatAppointmentStatus,
  formatAppointmentTimeRange,
  formatClientPhoneLabel,
  formatServicePriceLabel
} from "../lib/formatters";
import { styles } from "../lib/styles";
import type { Appointment } from "../lib/types";

export function AppointmentListCard({
  appointment,
  onPress,
  timezone
}: {
  appointment: Appointment;
  onPress: () => void;
  timezone: string;
}) {
  const phoneLabel = formatClientPhoneLabel(appointment.clientPhoneNumber);
  const priceLabel = formatServicePriceLabel(appointment.servicePrice);

  return (
    <Pressable onPress={onPress} style={styles.appointmentCard}>
      <View style={styles.appointmentCardHeader}>
        <Text style={styles.appointmentTime}>
          {formatAppointmentTimeRange(appointment.startsAt, appointment.endsAt, timezone)}
        </Text>
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
      <Text style={styles.appointmentClient}>{appointment.clientDisplayName}</Text>
      {phoneLabel ? <Text style={styles.appointmentMeta}>{phoneLabel}</Text> : null}
      <Text style={styles.appointmentMeta}>
        {appointment.serviceName} · {appointment.staffDisplayName}
      </Text>
      {priceLabel ? <Text style={styles.appointmentMeta}>Price: {priceLabel}</Text> : null}
    </Pressable>
  );
}
