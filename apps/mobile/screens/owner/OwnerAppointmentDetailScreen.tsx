import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { formatAppointmentDateOnly } from "../../lib/schedule";
import {
  formatAppointmentStatus,
  formatAppointmentTimeOnly,
  formatAppointmentTimeRange,
  formatClientPhoneLabel,
  formatServicePriceDisplay
} from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { ApiRequest, Appointment, Client, RunAction } from "../../lib/types";

export function OwnerAppointmentDetailScreen({
  appointmentId,
  businessId,
  initialAppointment,
  onBack,
  onBookForClient,
  onActionComplete,
  request,
  run,
  timezone
}: {
  appointmentId: string;
  businessId: string;
  initialAppointment?: Appointment;
  onBack: () => void;
  onBookForClient: (client: Pick<Client, "displayName" | "id" | "phoneNumber">) => void;
  onActionComplete: () => Promise<void>;
  request: ApiRequest;
  run: RunAction;
  timezone: string;
}) {
  const [appointment, setAppointment] = useState<Appointment | null>(initialAppointment ?? null);
  const [loading, setLoading] = useState(!initialAppointment);
  const [error, setError] = useState<string | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const loadAppointment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const details = await request<Appointment>(`/businesses/${businessId}/appointments/${appointmentId}`);
      setAppointment(details);
    } catch (loadError) {
      setAppointment(null);
      setError(loadError instanceof Error ? loadError.message : "Appointment unavailable");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, businessId, request]);

  useEffect(() => {
    if (!initialAppointment) {
      void loadAppointment();
    }
  }, [initialAppointment, loadAppointment]);

  async function completeAppointment() {
    await run(async () => {
      const updated = await request<Appointment>(`/businesses/${businessId}/appointments/${appointmentId}/complete`, {
        method: "POST"
      });
      setAppointment(updated);
      setConfirmingComplete(false);
      await onActionComplete();
    }, "Appointment completed");
  }

  async function cancelAppointment() {
    await run(async () => {
      const updated = await request<Appointment>(`/businesses/${businessId}/appointments/${appointmentId}/cancel`, {
        method: "POST"
      });
      setAppointment(updated);
      setConfirmingCancel(false);
      await onActionComplete();
    }, "Appointment cancelled");
  }

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.loading}>Loading appointment...</Text>
      </ScrollView>
    );
  }

  if (error || !appointment) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Back</Text>
        </Pressable>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Appointment unavailable</Text>
          <Text style={styles.emptyStateBody}>{error ?? "This appointment could not be found."}</Text>
        </View>
      </ScrollView>
    );
  }

  const phoneLabel = formatClientPhoneLabel(appointment.clientPhoneNumber);
  const priceLabel = formatServicePriceDisplay(appointment.servicePrice);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>Back</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{appointment.clientDisplayName}</Text>
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
        {phoneLabel ? (
          <>
            <Text style={styles.settingsLabel}>Phone</Text>
            <Text style={styles.settingsValue}>{phoneLabel}</Text>
          </>
        ) : null}
        <Text style={styles.settingsLabel}>Service</Text>
        <Text style={styles.settingsValue}>{appointment.serviceName}</Text>
        <Text style={styles.settingsMeta}>With {appointment.staffDisplayName}</Text>
        <Text style={styles.settingsMeta}>{formatAppointmentDateOnly(appointment.startsAt, timezone)}</Text>
        <Text style={styles.settingsMeta}>
          {formatAppointmentTimeOnly(appointment.startsAt, appointment.endsAt, timezone)}
        </Text>
        <Text style={styles.settingsMeta}>
          {formatAppointmentTimeRange(appointment.startsAt, appointment.endsAt, timezone)}
        </Text>
        {priceLabel ? <Text style={styles.settingsMeta}>Price: {priceLabel}</Text> : null}
        <Text style={styles.settingsMeta}>Saved client name: {appointment.clientDisplayName}</Text>
        {phoneLabel ? <Text style={styles.settingsMeta}>Saved phone: {phoneLabel}</Text> : null}
      </View>

      <Pressable
        onPress={() =>
          onBookForClient({
            displayName: appointment.clientDisplayName,
            id: appointment.clientId,
            phoneNumber: appointment.clientPhoneNumber
          })
        }
        style={[styles.primaryButton, styles.inlinePrimaryButton]}
      >
        <Text style={styles.primaryButtonText}>Book another appointment</Text>
      </Pressable>

      {appointment.status === "BOOKED" ? (
        <>
          {confirmingComplete ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmCardTitle}>Mark this appointment completed?</Text>
              <Text style={styles.cardMeta}>This updates today&apos;s schedule and cannot be undone.</Text>
              <View style={styles.row}>
                <Pressable
                  onPress={() => setConfirmingComplete(false)}
                  style={[styles.actionButton, styles.actionButtonSecondary, styles.halfButton]}
                >
                  <Text style={styles.actionButtonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void completeAppointment()}
                  style={[styles.actionButton, styles.actionButtonPrimary, styles.halfButton]}
                >
                  <Text style={styles.actionButtonPrimaryText}>Complete</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmingComplete(true)}
              style={[styles.actionButton, styles.actionButtonPrimary]}
            >
              <Text style={styles.actionButtonPrimaryText}>Complete appointment</Text>
            </Pressable>
          )}

          {confirmingCancel ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmCardTitle}>Cancel this appointment?</Text>
              <Text style={styles.cardMeta}>The client will no longer have this time reserved.</Text>
              <View style={styles.row}>
                <Pressable
                  onPress={() => setConfirmingCancel(false)}
                  style={[styles.actionButton, styles.actionButtonSecondary, styles.halfButton]}
                >
                  <Text style={styles.actionButtonSecondaryText}>Keep booked</Text>
                </Pressable>
                <Pressable
                  onPress={() => void cancelAppointment()}
                  style={[styles.actionButton, styles.actionButtonSecondary, styles.halfButton]}
                >
                  <Text style={styles.actionButtonSecondaryText}>Cancel appointment</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmingCancel(true)}
              style={[styles.actionButton, styles.actionButtonSecondary]}
            >
              <Text style={styles.actionButtonSecondaryText}>Cancel appointment</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
