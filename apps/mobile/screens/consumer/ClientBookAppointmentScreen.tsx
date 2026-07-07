import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Button, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DateStripPicker } from "../../components/DateStripPicker";
import { SlotGrid } from "../../components/SlotGrid";
import { buildDateStripOptions, formatDateKey } from "../../lib/dates";
import { formatServicePriceDisplay } from "../../lib/formatters";
import type { AvailableSlot, BookingConfirmationDetails, PublicBusinessProfile } from "../../lib/types";

export function buildConsumerBookAppointmentPayload(input: {
  serviceId: string;
  staffMemberId: string;
  startTime: string;
}): {
  serviceId: string;
  staffMemberId: string;
  startTime: string;
} {
  return {
    serviceId: input.serviceId,
    staffMemberId: input.staffMemberId,
    startTime: input.startTime
  };
}

export function ClientBookAppointmentScreen({
  business,
  initialSelections,
  isAuthenticated,
  onBack,
  onBooked,
  onRequireAuth,
  request,
  run
}: {
  business: PublicBusinessProfile;
  initialSelections?: {
    appointmentDate?: string;
    selectedServiceId?: string;
    selectedStaffMemberId?: string;
    selectedStartTime?: string;
  };
  isAuthenticated: boolean;
  onBack: () => void;
  onBooked: (confirmation: BookingConfirmationDetails) => void;
  onRequireAuth: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
}) {
  const dateOptions = useMemo(() => buildDateStripOptions(14), []);
  const [selectedServiceId, setSelectedServiceId] = useState(initialSelections?.selectedServiceId ?? "");
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState(initialSelections?.selectedStaffMemberId ?? "");
  const [appointmentDate, setAppointmentDate] = useState(
    initialSelections?.appointmentDate ?? formatDateKey(new Date())
  );
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedStartTime, setSelectedStartTime] = useState(initialSelections?.selectedStartTime ?? "");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const selectedService = business.services.find((service) => service.id === selectedServiceId);
  const selectedStaff = business.staff.find((member) => member.id === selectedStaffMemberId);
  const showStaffSection = business.staff.length > 1;

  useEffect(() => {
    if (business.staff.length === 1 && !selectedStaffMemberId) {
      setSelectedStaffMemberId(business.staff[0].id);
    }
  }, [business.staff, selectedStaffMemberId]);

  useEffect(() => {
    if (!isAuthenticated || !selectedServiceId || !selectedStaffMemberId || !appointmentDate) {
      setAvailableSlots([]);
      setSelectedStartTime("");
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);

    void request<AvailableSlot[]>(
      `/discovery/businesses/${business.id}/available-slots?serviceId=${selectedServiceId}&staffMemberId=${selectedStaffMemberId}&date=${appointmentDate}`
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
  }, [appointmentDate, business.id, isAuthenticated, request, selectedServiceId, selectedStaffMemberId]);

  function resetTimes() {
    setAvailableSlots([]);
    setSelectedStartTime("");
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Book at {business.name}</Text>
      <Button title="Back" onPress={onBack} />

      <Text style={styles.fieldLabel}>Choose a service</Text>
      {business.services.map((service) => {
        const selected = selectedServiceId === service.id;
        const priceLabel = formatServicePriceDisplay(service.price);

        return (
          <Pressable
            key={service.id}
            onPress={() => {
              setSelectedServiceId(service.id);
              resetTimes();
            }}
            style={[styles.serviceCard, selected && styles.serviceCardSelected]}
          >
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.serviceMeta}>{service.durationMinutes} min</Text>
            {priceLabel ? <Text style={styles.servicePrice}>{priceLabel}</Text> : null}
          </Pressable>
        );
      })}

      {showStaffSection ? (
        <>
          <Text style={styles.fieldLabel}>Choose staff</Text>
          {business.staff.map((staffMember) => (
            <Pressable
              key={staffMember.id}
              onPress={() => {
                setSelectedStaffMemberId(staffMember.id);
                resetTimes();
              }}
              style={[styles.staffChip, selectedStaffMemberId === staffMember.id && styles.staffChipSelected]}
            >
              <Text style={styles.staffChipText}>{staffMember.displayName}</Text>
            </Pressable>
          ))}
        </>
      ) : selectedStaff ? (
        <Text style={styles.staffHint}>With {selectedStaff.displayName}</Text>
      ) : null}

      {selectedServiceId && selectedStaffMemberId ? (
        <>
          <Text style={styles.fieldLabel}>Choose a date</Text>
          <DateStripPicker
            onSelect={(dateKey) => {
              setAppointmentDate(dateKey);
              resetTimes();
            }}
            options={dateOptions}
            selectedDateKey={appointmentDate}
          />

          {!isAuthenticated ? (
            <View style={styles.authNotice}>
              <Text style={styles.authNoticeText}>Sign in to see available times and confirm your booking.</Text>
              <Pressable onPress={onRequireAuth} style={styles.inlinePrimaryButton}>
                <Text style={styles.inlinePrimaryButtonText}>Sign in to continue</Text>
              </Pressable>
            </View>
          ) : (
            <>
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

              {selectedStartTime ? (
                <Pressable
                  onPress={() =>
                    void run(async () => {
                      if (!selectedService || !selectedStaff) {
                        throw new Error("Select a service and staff member");
                      }

                      const appointment = await request<{ startsAt: string }>(
                        `/discovery/businesses/${business.id}/appointments`,
                        {
                          body: JSON.stringify(
                            buildConsumerBookAppointmentPayload({
                              serviceId: selectedServiceId,
                              staffMemberId: selectedStaffMemberId,
                              startTime: selectedStartTime
                            })
                          ),
                          method: "POST"
                        }
                      );

                      onBooked({
                        businessName: business.name,
                        serviceName: selectedService.name,
                        staffName: selectedStaff.displayName,
                        startsAt: appointment.startsAt,
                        timezone: business.timezone
                      });
                    })
                  }
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Confirm booking</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {slotsLoading && isAuthenticated ? (
        <View style={styles.bottomLoader}>
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  authNotice: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 16
  },
  authNoticeText: {
    color: "#1e3a8a",
    lineHeight: 20
  },
  bottomLoader: {
    marginTop: 12
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  durationHint: {
    color: "#64748b",
    marginTop: 8,
    textAlign: "center"
  },
  errorText: {
    color: "#b45309",
    marginTop: 8
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 20
  },
  inlinePrimaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    marginTop: 12,
    paddingVertical: 12
  },
  inlinePrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    marginTop: 20,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8
  },
  serviceCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    padding: 16
  },
  serviceCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb"
  },
  serviceMeta: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4
  },
  serviceName: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700"
  },
  servicePrice: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 6
  },
  staffChip: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  staffChipSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb"
  },
  staffChipText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  staffHint: {
    color: "#64748b",
    marginTop: 16
  }
});
