import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ClientListCard } from "../../components/ClientListCard";
import { styles } from "../../lib/styles";
import type { ApiRequest, Client, ClientSummary, RunAction } from "../../lib/types";
import { ClientDetailsScreen } from "./ClientDetailsScreen";

type ClientsView = "list" | "details" | "create";

export function ClientsScreen({
  businessId,
  onBookAppointment,
  request,
  run,
  timezone
}: {
  businessId: string;
  onBookAppointment: (client: Client) => void;
  request: ApiRequest;
  run: RunAction;
  timezone: string;
}) {
  const [view, setView] = useState<ClientsView>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const loadClients = useCallback(
    async (search: string) => {
      setLoadingClients(true);

      try {
        const query = search.trim();
        const path =
          query.length > 0
            ? `/businesses/${businessId}/clients?search=${encodeURIComponent(query)}`
            : `/businesses/${businessId}/clients`;
        const results = await request<ClientSummary[]>(path);
        setClients(results);
      } finally {
        setLoadingClients(false);
      }
    },
    [businessId, request]
  );

  useEffect(() => {
    if (view !== "list") {
      return;
    }

    const timer = setTimeout(() => {
      void loadClients(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [loadClients, searchQuery, view]);

  if (view === "details" && selectedClientId) {
    return (
      <ClientDetailsScreen
        businessId={businessId}
        clientId={selectedClientId}
        onBack={() => {
          setView("list");
          setSelectedClientId(null);
        }}
        onBookAppointment={onBookAppointment}
        onClientUpdated={() => void loadClients(searchQuery)}
        request={request}
        run={run}
        timezone={timezone}
      />
    );
  }

  if (view === "create") {
    return (
      <ScrollView contentContainerStyle={styles.contentWithTabs}>
        <Pressable
          onPress={() => {
            setView("list");
            setNewClientName("");
            setNewClientPhone("");
            setNewClientEmail("");
          }}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>Back to clients</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Add client</Text>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          onChangeText={setNewClientName}
          placeholder="Client name"
          style={styles.input}
          value={newClientName}
        />
        <Text style={styles.fieldLabel}>Phone</Text>
        <TextInput
          keyboardType="phone-pad"
          onChangeText={setNewClientPhone}
          placeholder="Phone number (optional)"
          style={styles.input}
          value={newClientPhone}
        />
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setNewClientEmail}
          placeholder="Email address (optional)"
          style={styles.input}
          value={newClientEmail}
        />
        <Pressable
          onPress={() =>
            void run(async () => {
              if (!newClientName.trim()) {
                throw new Error("Enter a client name");
              }

              await request<Client>(`/businesses/${businessId}/clients`, {
                body: JSON.stringify({
                  displayName: newClientName.trim(),
                  email: newClientEmail.trim() || undefined,
                  phoneNumber: newClientPhone.trim() || undefined
                }),
                method: "POST"
              });

              setNewClientName("");
              setNewClientPhone("");
              setNewClientEmail("");
              setView("list");
              await loadClients(searchQuery);
            }, "Client created")
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Create client</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Clients</Text>
      <TextInput
        onChangeText={setSearchQuery}
        placeholder="Search by name, phone, or email"
        style={styles.input}
        value={searchQuery}
      />

      <Pressable onPress={() => setView("create")} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Add client</Text>
      </Pressable>

      {loadingClients ? <Text style={styles.loading}>Loading clients...</Text> : null}

      {!loadingClients && clients.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>
            {searchQuery.trim().length > 0 ? "No matching clients" : "No clients yet"}
          </Text>
          <Text style={styles.emptyStateBody}>
            {searchQuery.trim().length > 0
              ? "Try a different name, phone number, or email."
              : "Add your first client to keep customer details in one place."}
          </Text>
        </View>
      ) : null}

      {clients.map((client) => (
        <ClientListCard
          key={client.id}
          client={client}
          onPress={() => {
            setSelectedClientId(client.id);
            setView("details");
          }}
          timezone={timezone}
        />
      ))}
    </ScrollView>
  );
}
