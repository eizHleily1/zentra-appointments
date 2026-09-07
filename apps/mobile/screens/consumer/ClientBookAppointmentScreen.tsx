import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DateStripPicker } from "../../components/DateStripPicker";
import { apiErrorStatus } from "../../lib/api";
import { SlotGrid } from "../../components/SlotGrid";
import { buildDateStripOptions, formatDateKey } from "../../lib/dates";
import { formatServicePriceDisplay } from "../../lib/formatters";
import type { AvailableSlot, BookingConfirmationDetails, PublicBusinessProfile } from "../../lib/types";

export type PhoneVerificationStep = "idle" | "sending" | "sent" | "verifying" | "verified";

export function buildConsumerBookAppointmentPayload(input: {
  displayName: string;
  phoneNumber: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
  verificationId: string;
}): {
  displayName: string;
  phoneNumber: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
  verificationId: string;
} {
  return {
    displayName: input.displayName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    serviceId: input.serviceId,
    staffMemberId: input.staffMemberId,
    startTime: input.startTime,
    verificationId: input.verificationId
  };
}

export function buildBookingVerificationRequestPayload(input: { phoneNumber: string }): { phoneNumber: string } {
  return { phoneNumber: input.phoneNumber.trim() };
}

export function ClientBookAppointmentScreen({
  business,
  initialSelections,
  onBack,
  onBooked,
  request
}: {
  business: PublicBusinessProfile;
  initialSelections?: {
    appointmentDate?: string;
    selectedServiceId?: string;
    selectedStaffMemberId?: string;
    selectedStartTime?: string;
  };
  onBack: () => void;
  onBooked: (confirmation: BookingConfirmationDetails) => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}) {
  const dateOptions = useMemo(() => buildDateStripOptions(14), []);
  const [selectedServiceId, setSelectedServiceId] = useState(initialSelections?.selectedServiceId ?? "");
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState(initialSelections?.selectedStaffMemberId ?? "");
  const [appointmentDate, setAppointmentDate] = useState(
    initialSelections?.appointmentDate ?? formatDateKey(new Date())
  );
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedStartTime, setSelectedStartTime] = useState(initialSelections?.selectedStartTime ?? "");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<PhoneVerificationStep>("idle");
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const selectedService = business.services.find((service) => service.id === selectedServiceId);
  const selectedStaff = business.staff.find((member) => member.id === selectedStaffMemberId);
  const showStaffSection = business.staff.length > 1;

  useEffect(() => {
    if (business.staff.length === 1 && !selectedStaffMemberId) {
      setSelectedStaffMemberId(business.staff[0].id);
    }
  }, [business.staff, selectedStaffMemberId]);

  useEffect(() => {
    if (!selectedServiceId || !selectedStaffMemberId || !appointmentDate) {
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
  }, [appointmentDate, business.id, request, selectedServiceId, selectedStaffMemberId]);

  function resetTimes() {
    setAvailableSlots([]);
    setSelectedStartTime("");
  }

  // A challenge is tied to the phone number, so editing the number invalidates it.
  // Changing the name or the slot does not, which is what lets a guest retry after a
  // slot is taken without asking for another code.
  function changePhoneNumber(value: string) {
    setPhoneNumber(value);
    setVerificationStep("idle");
    setVerificationId("");
    setVerificationCode("");
    setVerificationError(null);
    setBookingError(null);
  }

  async function sendVerificationCode() {
    if (!phoneNumber.trim()) {
      setVerificationError("Enter a phone number");
      return;
    }

    setVerificationStep("sending");
    setVerificationError(null);
    setBookingError(null);

    try {
      const challenge = await request<{ verificationId: string }>(
        `/discovery/businesses/${business.id}/booking-verifications`,
        {
          body: JSON.stringify(buildBookingVerificationRequestPayload({ phoneNumber })),
          method: "POST"
        }
      );

      setVerificationId(challenge.verificationId);
      setVerificationCode("");
      setVerificationStep("sent");
    } catch (error: unknown) {
      // A rejected resend (throttled, offline) says nothing about the challenge the guest
      // already holds, so keep the code entry visible instead of forcing a restart.
      setVerificationStep(verificationId ? "sent" : "idle");
      setVerificationError(error instanceof Error ? error.message : "Could not send a verification code");
    }
  }

  async function verifyCode() {
    setVerificationStep("verifying");
    setVerificationError(null);

    try {
      await request(`/discovery/businesses/${business.id}/booking-verifications/${verificationId}/verify`, {
        body: JSON.stringify({ code: verificationCode.trim() }),
        method: "POST"
      });

      setVerificationStep("verified");
    } catch (error: unknown) {
      setVerificationStep("sent");
      setVerificationError(error instanceof Error ? error.message : "Could not verify that code");
    }
  }

  async function confirmBooking() {
    if (!selectedService || !selectedStaff) {
      setBookingError("Select a service and staff member");
      return;
    }

    if (!displayName.trim()) {
      setBookingError("Enter your name");
      return;
    }

    setBooking(true);
    setBookingError(null);

    try {
      const appointment = await request<{ startsAt: string }>(
        `/discovery/businesses/${business.id}/appointments`,
        {
          body: JSON.stringify(
            buildConsumerBookAppointmentPayload({
              displayName,
              phoneNumber,
              serviceId: selectedServiceId,
              staffMemberId: selectedStaffMemberId,
              startTime: selectedStartTime,
              verificationId
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
    } catch (error: unknown) {
      // The API rejects the booking with 400 when the challenge is expired, consumed, or
      // otherwise unusable. Dropping the verified state is the only way back to a working
      // flow. A 409 only means the slot went away, so the challenge stays usable.
      if (apiErrorStatus(error) === 400) {
        setVerificationStep("idle");
        setVerificationId("");
        setVerificationCode("");
        setVerificationError(null);
      }

      setBookingError(error instanceof Error ? error.message : "Could not confirm the booking");
    } finally {
      setBooking(false);
    }
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
            <>
              <Text style={styles.fieldLabel}>Your details</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setDisplayName}
                placeholder="Your name"
                style={styles.input}
                value={displayName}
              />
              <TextInput
                autoCapitalize="none"
                keyboardType="phone-pad"
                onChangeText={changePhoneNumber}
                placeholder="Phone number"
                style={styles.input}
                value={phoneNumber}
              />

              {verificationStep === "verified" ? (
                <Text style={styles.successText}>Phone verified</Text>
              ) : (
                <>
                  <Pressable
                    disabled={verificationStep === "sending" || verificationStep === "verifying"}
                    onPress={() => void sendVerificationCode()}
                    style={[
                      styles.secondaryButton,
                      verificationStep === "sending" && styles.secondaryButtonDisabled
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {verificationStep === "sending"
                        ? "Sending code..."
                        : verificationStep === "idle"
                          ? "Send code"
                          : "Resend code"}
                    </Text>
                  </Pressable>

                  {verificationStep === "sent" || verificationStep === "verifying" ? (
                    <>
                      <Text style={styles.helperText}>
                        We sent a 6-digit code to {phoneNumber.trim()}. It expires in a few minutes.
                      </Text>
                      <TextInput
                        autoCapitalize="none"
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={setVerificationCode}
                        placeholder="6-digit code"
                        style={styles.input}
                        value={verificationCode}
                      />
                      <Pressable
                        disabled={verificationStep === "verifying" || verificationCode.trim().length === 0}
                        onPress={() => void verifyCode()}
                        style={[
                          styles.secondaryButton,
                          (verificationStep === "verifying" || verificationCode.trim().length === 0) &&
                            styles.secondaryButtonDisabled
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {verificationStep === "verifying" ? "Checking code..." : "Verify code"}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </>
              )}

              {verificationError ? <Text style={styles.errorText}>{verificationError}</Text> : null}
              {bookingError ? <Text style={styles.errorText}>{bookingError}</Text> : null}

              {verificationStep === "verified" ? (
                <Pressable
                  disabled={booking}
                  onPress={() => void confirmBooking()}
                  style={[styles.primaryButton, booking && styles.primaryButtonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {booking ? "Confirming..." : "Confirm booking"}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.helperText}>Verify your phone number to confirm this booking.</Text>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {slotsLoading ? (
        <View style={styles.bottomLoader}>
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  helperText: {
    color: "#64748b",
    marginTop: 10
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    padding: 12
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    marginTop: 20,
    paddingVertical: 14
  },
  primaryButtonDisabled: {
    backgroundColor: "#94a3b8"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 12
  },
  secondaryButtonDisabled: {
    backgroundColor: "#f1f5f9"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 15,
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
  },
  successText: {
    color: "#15803d",
    fontWeight: "700",
    marginTop: 12
  }
});
