import { Pressable, Text, View } from "react-native";
import {
  formatAppointmentStatus,
  formatAppointmentTimeOnly,
  formatAppointmentTimeRange,
  formatClientPhoneLabel,
  formatServicePriceLabel
} from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { ApiRequest, Appointment, RunAction } from "../../lib/types";

export function AppointmentCard({
  appointment,
  businessId,
  compact = false,
  onActionComplete,
  request,
  run,
  timezone
}: {
  appointment: Appointment;
  businessId: string;
  compact?: boolean;
  onActionComplete: () => void | Promise<void>;
  request: ApiRequest;
  run: RunAction;
  timezone: string;
}) {
  const timeLabel = compact
    ? formatAppointmentTimeOnly(appointment.startsAt, appointment.endsAt, timezone)
    : formatAppointmentTimeRange(appointment.startsAt, appointment.endsAt, timezone);
  const priceLabel = formatServicePriceLabel(appointment.servicePrice);

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentCardHeader}>
        <Text style={styles.appointmentTime}>{timeLabel}</Text>
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
      {formatClientPhoneLabel(appointment.clientPhoneNumber) ? (
        <Text style={styles.appointmentMeta}>{formatClientPhoneLabel(appointment.clientPhoneNumber)}</Text>
      ) : null}
      <Text style={styles.appointmentMeta}>
        {appointment.serviceName} · {appointment.staffDisplayName}
      </Text>
      {priceLabel ? <Text style={styles.appointmentMeta}>Price: {priceLabel}</Text> : null}
      {appointment.status === "BOOKED" ? (
        <View style={styles.row}>
          <Pressable
            onPress={() =>
              void run(async () => {
                await request<Appointment>(`/businesses/${businessId}/appointments/${appointment.id}/complete`, {
                  method: "POST"
                });
                await onActionComplete();
              }, "Appointment completed")
            }
            style={[styles.actionButton, styles.actionButtonPrimary]}
          >
            <Text style={styles.actionButtonPrimaryText}>Complete</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              void run(async () => {
                await request<Appointment>(`/businesses/${businessId}/appointments/${appointment.id}/cancel`, {
                  method: "POST"
                });
                await onActionComplete();
              }, "Appointment cancelled")
            }
            style={[styles.actionButton, styles.actionButtonSecondary]}
          >
            <Text style={styles.actionButtonSecondaryText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
