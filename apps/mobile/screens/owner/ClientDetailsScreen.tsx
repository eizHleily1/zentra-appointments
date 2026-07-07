import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ClientAppointmentHistoryCard } from "../../components/ClientAppointmentHistoryCard";
import { formatLinkedAccountStatus } from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { ApiRequest, Client, ClientDetailsResponse, RunAction } from "../../lib/types";

export function ClientDetailsScreen({
  businessId,
  clientId,
  onBack,
  onBookAppointment,
  onClientUpdated,
  request,
  run,
  timezone
}: {
  businessId: string;
  clientId: string;
  onBack: () => void;
  onBookAppointment: (client: Client) => void;
  onClientUpdated: () => void;
  request: ApiRequest;
  run: RunAction;
  timezone: string;
}) {
  const [details, setDetails] = useState<ClientDetailsResponse | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);

    try {
      const response = await request<ClientDetailsResponse>(`/businesses/${businessId}/clients/${clientId}`);
      setDetails(response);
      setDisplayName(response.client.displayName);
      setPhoneNumber(response.client.phoneNumber ?? "");
      setEmail(response.client.email ?? "");
    } finally {
      setLoading(false);
    }
  }, [businessId, clientId, request]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  async function saveChanges() {
    await run(async () => {
      const updated = await request<Client>(`/businesses/${businessId}/clients/${clientId}`, {
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim() || null,
          phoneNumber: phoneNumber.trim() || null
        }),
        method: "PATCH"
      });

      setDetails((current) => (current ? { ...current, client: updated } : current));
      onClientUpdated();
    }, "Client updated");
  }

  async function deactivateClient() {
    await run(async () => {
      await request<Client>(`/businesses/${businessId}/clients/${clientId}/deactivate`, {
        method: "POST"
      });
      onClientUpdated();
      onBack();
    }, "Client deactivated");
  }

  if (loading || !details) {
    return (
      <ScrollView contentContainerStyle={styles.contentWithTabs}>
        <Pressable onPress={onBack} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Back to clients</Text>
        </Pressable>
        <Text style={styles.loading}>Loading client...</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Pressable onPress={onBack} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>Back to clients</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{details.client.displayName}</Text>
      <Text style={styles.cardMeta}>{formatLinkedAccountStatus(details.client.linkedUserId)}</Text>

      <Pressable
        onPress={() => onBookAppointment(details.client)}
        style={[styles.primaryButton, styles.inlinePrimaryButton]}
      >
        <Text style={styles.primaryButtonText}>Book appointment</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput onChangeText={setDisplayName} placeholder="Client name" style={styles.input} value={displayName} />

      <Text style={styles.fieldLabel}>Phone</Text>
      <TextInput
        keyboardType="phone-pad"
        onChangeText={setPhoneNumber}
        placeholder="Phone number"
        style={styles.input}
        value={phoneNumber}
      />

      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email address"
        style={styles.input}
        value={email}
      />

      <Pressable onPress={() => void saveChanges()} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Save changes</Text>
      </Pressable>

      {confirmingDeactivate ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmCardTitle}>Deactivate {details.client.displayName}?</Text>
          <Text style={styles.cardMeta}>
            They will no longer appear in your client list and cannot be booked. Past appointments stay unchanged.
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setConfirmingDeactivate(false)}
              style={[styles.actionButton, styles.actionButtonSecondary, styles.halfButton]}
            >
              <Text style={styles.actionButtonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void deactivateClient()}
              style={[styles.actionButton, styles.actionButtonPrimary, styles.halfButton]}
            >
              <Text style={styles.actionButtonPrimaryText}>Deactivate</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirmingDeactivate(true)}
          style={[styles.actionButton, styles.actionButtonSecondary]}
        >
          <Text style={styles.actionButtonSecondaryText}>Deactivate client</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Appointment history</Text>
      {details.appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No appointments yet</Text>
          <Text style={styles.emptyStateBody}>Past bookings will appear here with the details saved at booking time.</Text>
        </View>
      ) : (
        details.appointments.map((appointment) => (
          <ClientAppointmentHistoryCard key={appointment.id} appointment={appointment} timezone={timezone} />
        ))
      )}
    </ScrollView>
  );
}
