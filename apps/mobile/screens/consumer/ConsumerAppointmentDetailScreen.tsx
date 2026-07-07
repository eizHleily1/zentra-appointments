import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ConsumerAppointmentView } from "../../components/ConsumerAppointmentCard";
import {
  formatAppointmentDateOnly,
  formatAppointmentDayHeading
} from "../../lib/schedule";
import {
  formatAppointmentStatus,
  formatAppointmentTimeOnly,
  formatBusinessLocation,
  formatServicePriceDisplay
} from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { ApiRequest } from "../../lib/types";

export function ConsumerAppointmentDetailScreen({
  appointmentId,
  onBack,
  onBookAgain,
  request
}: {
  appointmentId: string;
  onBack: () => void;
  onBookAgain: (businessId: string) => void;
  request: ApiRequest;
}) {
  const [appointment, setAppointment] = useState<ConsumerAppointmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const details = await request<ConsumerAppointmentView>(`/me/appointments/${appointmentId}`);
      setAppointment(details);
    } catch (loadError) {
      setAppointment(null);
      setError(loadError instanceof Error ? loadError.message : "Appointment unavailable");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, request]);

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Back to Schedule</Text>
        </Pressable>
        <Text style={styles.loading}>Loading appointment...</Text>
      </ScrollView>
    );
  }

  if (error || !appointment) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Back to Schedule</Text>
        </Pressable>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Appointment unavailable</Text>
          <Text style={styles.emptyStateBody}>{error ?? "This appointment could not be found."}</Text>
        </View>
      </ScrollView>
    );
  }

  const locationLabel = formatBusinessLocation(appointment.businessCity, appointment.businessAddress);
  const priceLabel = formatServicePriceDisplay(appointment.servicePrice);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>Back to Schedule</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{appointment.businessName}</Text>
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

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Service</Text>
        <Text style={styles.settingsValue}>{appointment.serviceName}</Text>
        <Text style={styles.settingsMeta}>With {appointment.staffDisplayName}</Text>
        <Text style={styles.settingsMeta}>
          {formatAppointmentDayHeading(appointment.startsAt, appointment.businessTimezone)}
        </Text>
        <Text style={styles.settingsMeta}>{formatAppointmentDateOnly(appointment.startsAt, appointment.businessTimezone)}</Text>
        <Text style={styles.settingsMeta}>
          {formatAppointmentTimeOnly(appointment.startsAt, appointment.endsAt, appointment.businessTimezone)}
        </Text>
        <Text style={styles.settingsMeta}>Booked as {appointment.clientDisplayName}</Text>
        {priceLabel ? <Text style={styles.settingsMeta}>Price: {priceLabel}</Text> : null}
        {locationLabel ? <Text style={styles.settingsMeta}>{locationLabel}</Text> : null}
      </View>

      <Pressable
        onPress={() => onBookAgain(appointment.businessId)}
        style={[styles.primaryButton, styles.inlinePrimaryButton]}
      >
        <Text style={styles.primaryButtonText}>Book again</Text>
      </Pressable>
    </ScrollView>
  );
}
