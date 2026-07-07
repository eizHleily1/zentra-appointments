import { useEffect, useMemo, useState } from "react";
import { Button, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { DateStripPicker } from "../../components/DateStripPicker";
import { SlotGrid } from "../../components/SlotGrid";
import { buildDateStripOptions, formatDateKey } from "../../lib/dates";
import { formatClientPhoneLabel, formatServicePriceLabel } from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type {
  ApiRequest,
  Appointment,
  AvailableSlot,
  BusinessService,
  Client,
  RunAction,
  StaffMember
} from "../../lib/types";
import { buildBookAppointmentPayload } from "./bookAppointment";

export { buildBookAppointmentPayload } from "./bookAppointment";

export function BookAppointmentScreen({
  businessId,
  onBack,
  refresh,
  request,
  run,
  services,
  staffMembers
}: {
  businessId: string;
  onBack: () => void;
  refresh: () => Promise<void>;
  request: ApiRequest;
  run: RunAction;
  services: BusinessService[];
  staffMembers: StaffMember[];
}) {
  const dateOptions = useMemo(() => buildDateStripOptions(14), []);
  const [clientSearch, setClientSearch] = useState("");
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientLabel, setSelectedClientLabel] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(formatDateKey(new Date()));
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const clientSelected = selectedClientId.length > 0;
  const showStaffSection = staffMembers.length > 1;
  const selectedService = services.find((service) => service.id === selectedServiceId);

  useEffect(() => {
    if (staffMembers.length === 1 && !selectedStaffMemberId) {
      setSelectedStaffMemberId(staffMembers[0].id);
    }
  }, [selectedStaffMemberId, staffMembers]);

  useEffect(() => {
    if (!clientSelected || !selectedServiceId || !selectedStaffMemberId || !appointmentDate) {
      setAvailableSlots([]);
      setSelectedStartTime("");
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);

    void request<AvailableSlot[]>(
      `/businesses/${businessId}/available-slots?serviceId=${selectedServiceId}&staffMemberId=${selectedStaffMemberId}&date=${appointmentDate}`
    )
      .then((slots) => {
        if (!cancelled) {
          setAvailableSlots(slots);
          setSelectedStartTime("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAvailableSlots([]);
          setSlotsError(error instanceof Error ? error.message : "Could not load available times");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appointmentDate, businessId, clientSelected, request, selectedServiceId, selectedStaffMemberId]);

  function resetSchedulingState() {
    setAvailableSlots([]);
    setSelectedStartTime("");
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Book appointment</Text>
      <Button title="Back" onPress={onBack} />

      <Text style={styles.fieldLabel}>Client</Text>
      {clientSelected ? (
        <View style={styles.selectedClientBanner}>
          <Text style={styles.selectionButtonTitle}>{selectedClientLabel}</Text>
          <Pressable
            onPress={() => {
              setSelectedClientId("");
              setSelectedClientLabel("");
              resetSchedulingState();
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>Change client</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            onChangeText={setClientSearch}
            placeholder="Search by name or phone"
            style={styles.input}
            value={clientSearch}
          />
          <Pressable
            onPress={() =>
              void run(async () => {
                const query = clientSearch.trim();
                const path =
                  query.length > 0
                    ? `/businesses/${businessId}/clients?search=${encodeURIComponent(query)}`
                    : `/businesses/${businessId}/clients`;
                const clients = await request<Client[]>(path);
                setMatchingClients(clients);
              })
            }
            style={[styles.primaryButton, styles.inlinePrimaryButton]}
          >
            <Text style={styles.primaryButtonText}>Search clients</Text>
          </Pressable>

          {matchingClients.length === 0 ? (
            <Text style={styles.empty}>Search for an existing client or create a new one below.</Text>
          ) : (
            matchingClients.map((client) => (
              <Pressable
                key={client.id}
                onPress={() => {
                  setSelectedClientId(client.id);
                  setSelectedClientLabel(
                    formatClientPhoneLabel(client.phoneNumber)
                      ? `${client.displayName} · ${formatClientPhoneLabel(client.phoneNumber)}`
                      : client.displayName
                  );
                  resetSchedulingState();
                }}
                style={styles.selectionButton}
              >
                <Text style={styles.selectionButtonTitle}>{client.displayName}</Text>
                {formatClientPhoneLabel(client.phoneNumber) ? (
                  <Text style={styles.selectionButtonMeta}>{formatClientPhoneLabel(client.phoneNumber)}</Text>
                ) : null}
              </Pressable>
            ))
          )}

          <Text style={styles.fieldLabel}>Or create new client</Text>
          <TextInput
            onChangeText={setNewClientName}
            placeholder="Client name"
            style={styles.input}
            value={newClientName}
          />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={setNewClientPhone}
            placeholder="Phone (optional)"
            style={styles.input}
            value={newClientPhone}
          />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setNewClientEmail}
            placeholder="Email (optional)"
            style={styles.input}
            value={newClientEmail}
          />
          <Pressable
            onPress={() =>
              void run(async () => {
                if (!newClientName.trim()) {
                  throw new Error("Enter a client name");
                }

                const client = await request<Client>(`/businesses/${businessId}/clients`, {
                  body: JSON.stringify({
                    displayName: newClientName.trim(),
                    email: newClientEmail.trim() || undefined,
                    phoneNumber: newClientPhone.trim() || undefined
                  }),
                  method: "POST"
                });

                setSelectedClientId(client.id);
                setSelectedClientLabel(
                  formatClientPhoneLabel(client.phoneNumber)
                    ? `${client.displayName} · ${formatClientPhoneLabel(client.phoneNumber)}`
                    : client.displayName
                );
                setMatchingClients([client]);
                resetSchedulingState();
              }, "Client created")
            }
            style={[styles.primaryButton, styles.inlinePrimaryButton]}
          >
            <Text style={styles.primaryButtonText}>Create and select client</Text>
          </Pressable>
        </>
      )}

      {clientSelected ? (
        <>
          <Text style={styles.fieldLabel}>Service</Text>
          {services.length === 0 ? (
            <Text style={styles.empty}>Add a service first in the Services tab.</Text>
          ) : (
            services.map((service) => {
              const selected = selectedServiceId === service.id;
              const priceLabel = formatServicePriceLabel(service.price);

              return (
                <Pressable
                  key={service.id}
                  onPress={() => {
                    setSelectedServiceId(service.id);
                    resetSchedulingState();
                  }}
                  style={[styles.serviceCard, selected && styles.serviceCardSelected]}
                >
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.serviceMeta}>{service.durationMinutes} min</Text>
                  {priceLabel ? <Text style={styles.servicePrice}>{priceLabel}</Text> : null}
                </Pressable>
              );
            })
          )}

          {showStaffSection ? (
            <>
              <Text style={styles.fieldLabel}>Staff member</Text>
              {staffMembers.map((staffMember) => (
                <Pressable
                  key={staffMember.id}
                  onPress={() => {
                    setSelectedStaffMemberId(staffMember.id);
                    resetSchedulingState();
                  }}
                  style={[styles.staffChip, selectedStaffMemberId === staffMember.id && styles.staffChipSelected]}
                >
                  <Text style={styles.staffChipText}>{staffMember.displayName}</Text>
                </Pressable>
              ))}
            </>
          ) : staffMembers.length === 1 ? (
            <Text style={styles.staffHint}>With {staffMembers[0].displayName}</Text>
          ) : staffMembers.length === 0 ? (
            <Text style={styles.empty}>Add staff first in the Staff tab.</Text>
          ) : null}

          {selectedServiceId && selectedStaffMemberId ? (
            <>
              <Text style={styles.fieldLabel}>Choose a date</Text>
              <DateStripPicker
                onSelect={(dateKey) => {
                  setAppointmentDate(dateKey);
                  resetSchedulingState();
                }}
                options={dateOptions}
                selectedDateKey={appointmentDate}
              />

              <Text style={styles.fieldLabel}>Choose a time</Text>
              {slotsError ? <Text style={styles.errorText}>{slotsError}</Text> : null}
              <SlotGrid
                loading={slotsLoading}
                onSelect={setSelectedStartTime}
                selectedStartTime={selectedStartTime}
                slots={availableSlots}
              />
              {selectedService ? (
                <Text style={styles.durationHint}>{selectedService.durationMinutes} min appointment</Text>
              ) : null}
            </>
          ) : null}

          {selectedStartTime ? (
            <Pressable
              onPress={() =>
                void run(async () => {
                  if (!selectedServiceId) {
                    throw new Error("Select a service");
                  }

                  if (!selectedStaffMemberId) {
                    throw new Error("Select a staff member");
                  }

                  await request<Appointment>(`/businesses/${businessId}/appointments`, {
                    body: JSON.stringify(
                      buildBookAppointmentPayload({
                        clientId: selectedClientId,
                        serviceId: selectedServiceId,
                        staffMemberId: selectedStaffMemberId,
                        startTime: selectedStartTime
                      })
                    ),
                    method: "POST"
                  });
                  await refresh();
                  resetSchedulingState();
                  onBack();
                }, "Appointment booked")
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Confirm booking</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
