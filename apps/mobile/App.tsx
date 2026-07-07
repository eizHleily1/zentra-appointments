import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { ConsumerAppointmentCard } from "./components/ConsumerAppointmentCard";
import { AuthPromptModal } from "./components/AuthPromptModal";
import { ConsumerTabBar, type ConsumerTab } from "./components/ConsumerTabBar";
import { DateStripPicker } from "./components/DateStripPicker";
import { SlotGrid } from "./components/SlotGrid";
import { buildDateStripOptions, formatDateKey } from "./lib/dates";
import { BookingConfirmationScreen } from "./screens/consumer/BookingConfirmationScreen";
import { ClientBookAppointmentScreen } from "./screens/consumer/ClientBookAppointmentScreen";
import { ConsumerHomeScreen } from "./screens/consumer/ConsumerHomeScreen";
import { ExploreTabScreen, type DiscoveryCategoryId } from "./screens/consumer/ExploreTabScreen";
import { ProfileTabScreen } from "./screens/consumer/ProfileTabScreen";
import type { BookingConfirmationDetails } from "./lib/types";

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

type Tab = "home" | "appointments" | "services" | "staff" | "settings";

type OverlayScreen = "book" | "business-hours" | null;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

interface Business {
  businessType: string;
  city?: string | null;
  id: string;
  name: string;
  status: string;
  timezone: string;
}

interface PublishReadiness {
  canPublish: boolean;
  missingSteps: string[];
  requirements: {
    hasCity: boolean;
    hasService: boolean;
    hasStaff: boolean;
  };
  status: string;
}

interface BusinessService {
  active: boolean;
  businessId: string;
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
  price: number | null;
}

interface StaffMember {
  active: boolean;
  businessId: string;
  displayName: string;
  id: string;
  userId: string;
}

interface Client {
  active: boolean;
  businessId: string;
  displayName: string;
  email: string | null;
  id: string;
  linkedUserId: string | null;
  phoneNumber: string | null;
}

interface Appointment {
  businessId: string;
  clientDisplayName: string;
  clientId: string;
  clientPhoneNumber: string | null;
  endsAt: string;
  id: string;
  serviceDurationMinutes: number;
  serviceName: string;
  servicePrice: number | null;
  staffDisplayName: string;
  startsAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
}

interface BusinessHour {
  closeTime: string | null;
  dayOfWeek: number;
  id: string;
  isClosed: boolean;
  openTime: string | null;
}

interface AvailableSlot {
  endTime: string;
  label: string;
  startTime: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  BARBER: "Barber Shop",
  CLINIC: "Clinic",
  COACH: "Coaching",
  CONSULTANT: "Consulting",
  NAIL_ARTIST: "Nail Salon",
  OTHER: "Other",
  PERSONAL_TRAINER: "Personal Training",
  SALON: "Hair Salon",
  THERAPIST: "Therapy"
};

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABELS);

export const DISCOVERY_CATEGORY_OPTIONS = [
  { id: "BARBER", label: "Barber" },
  { id: "BEAUTY", label: "Beauty" },
  { id: "DENTIST", label: "Dentist" },
  { id: "FITNESS", label: "Fitness" },
  { id: "CLINIC", label: "Clinic" },
  { id: "COACHING", label: "Coaching" },
  { id: "OTHER", label: "Other" }
] as const;

export type { DiscoveryCategoryId };

interface PublicBusinessSummary {
  address: string | null;
  businessType: string;
  city: string | null;
  id: string;
  name: string;
  timezone: string;
}

interface PublicBusinessProfile extends PublicBusinessSummary {
  businessHours: BusinessHour[];
  services: Array<{
    description: string;
    durationMinutes: number;
    id: string;
    name: string;
    price: number | null;
  }>;
  staff: Array<{
    displayName: string;
    id: string;
  }>;
}

interface ConsumerAppointment extends Appointment {
  businessName: string;
  businessTimezone: string;
}

type AppArea = "consumer" | "owner";
type ClientScreen = "home" | "profile" | "book" | "confirmed";

export function formatBusinessLocation(city: string | null | undefined, address: string | null | undefined): string | null {
  const parts = [city?.trim(), address?.trim()].filter((part) => part && part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" · ");
}

export function formatBusinessHoursSummary(businessHours: BusinessHour[]): string {
  const openDays = businessHours.filter((hour) => !hour.isClosed && hour.openTime && hour.closeTime);

  if (openDays.length === 0) {
    return "Closed";
  }

  const first = openDays[0];
  const uniform = openDays.every(
    (hour) => hour.openTime === first.openTime && hour.closeTime === first.closeTime
  );

  if (uniform && openDays.length >= 5) {
    return `${DAY_NAMES[first.dayOfWeek].slice(0, 3)}–${DAY_NAMES[openDays[openDays.length - 1].dayOfWeek].slice(0, 3)} ${first.openTime}–${first.closeTime}`;
  }

  return openDays
    .map((hour) => `${DAY_NAMES[hour.dayOfWeek].slice(0, 3)} ${hour.openTime}–${hour.closeTime}`)
    .join(", ");
}

export { buildConsumerBookAppointmentPayload, ClientBookAppointmentScreen } from "./screens/consumer/ClientBookAppointmentScreen";
export { ConsumerAppointmentCard } from "./components/ConsumerAppointmentCard";

export function formatServicePriceLabel(price: number | null | undefined): string | null {
  if (price === null || price === undefined || price === 0) {
    return null;
  }

  return String(price);
}

export function formatAppointmentStatus(status: Appointment["status"]): string {
  switch (status) {
    case "BOOKED":
      return "Booked";
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
  }
}

export function formatBusinessType(businessType: string): string {
  return BUSINESS_TYPE_LABELS[businessType] ?? businessType.replaceAll("_", " ");
}

export function formatBusinessStatus(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "DEACTIVATED":
      return "Deactivated";
    case "PENDING_ONBOARDING":
      return "Finish setup";
    default:
      return status.replaceAll("_", " ");
  }
}

export function formatClientPhoneLabel(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber || phoneNumber.trim().length === 0) {
    return null;
  }

  return phoneNumber.trim();
}

export function formatAppointmentTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short"
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });

  return `${dateFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

export function formatAppointmentTimeOnly(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });

  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}

export function formatTodayHeading(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
    year: "numeric"
  }).format(now);
}

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });
  const values: Record<string, string> = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function isAppointmentOnDate(appointment: Appointment, dateKey: string, timeZone: string): boolean {
  return getDateKeyInTimeZone(new Date(appointment.startsAt), timeZone) === dateKey;
}

export function sortAppointmentsChronologically(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
  );
}

function getApiBaseUrl(): string {
  if (Platform.OS === "web") {
    return "/api";
  }

  return process.env?.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
}

const API_URL = getApiBaseUrl();

async function apiFetch<T>(path: string, options: RequestInit = {}, accessToken?: string | null): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new Error(message ?? "Request failed");
  }

  return data as T;
}

export default function App() {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [appArea, setAppArea] = useState<AppArea>("consumer");
  const [consumerTab, setConsumerTab] = useState<ConsumerTab>("explore");
  const [authScreen, setAuthScreen] = useState<"businesses" | "create-business">("businesses");
  const [clientScreen, setClientScreen] = useState<ClientScreen>("home");
  const [exploreSearch, setExploreSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DiscoveryCategoryId | null>(null);
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<PublicBusinessSummary[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [publishReadiness, setPublishReadiness] = useState<PublishReadiness | null>(null);
  const [selectedDiscoveryBusiness, setSelectedDiscoveryBusiness] = useState<PublicBusinessProfile | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmationDetails | null>(null);
  const [myAppointments, setMyAppointments] = useState<ConsumerAppointment[]>([]);
  const [recentBusinesses, setRecentBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [pendingBookingBusiness, setPendingBookingBusiness] = useState<PublicBusinessProfile | null>(null);
  const [pendingProfileAuth, setPendingProfileAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const api = useMemo(
    () => ({
      request: <T,>(path: string, options: RequestInit = {}) =>
        apiFetch<T>(path, options, tokens?.accessToken ?? null)
    }),
    [tokens]
  );

  const run = useCallback(async (action: () => Promise<void>, successMessage?: string) => {
    setLoading(true);
    setMessage(null);

    try {
      await action();
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBusinesses = useCallback(async () => {
    if (!tokens) {
      return [];
    }

    const nextBusinesses = await api.request<Business[]>("/businesses");
    setBusinesses(nextBusinesses);
    return nextBusinesses;
  }, [api, tokens]);

  const loadBusinessData = useCallback(async (business: Business) => {
    const [nextServices, nextStaffMembers, nextAppointments, nextBusiness] = await Promise.all([
      api.request<BusinessService[]>(`/businesses/${business.id}/services`),
      api.request<StaffMember[]>(`/businesses/${business.id}/staff`),
      api.request<Appointment[]>(`/businesses/${business.id}/appointments`),
      api.request<Business>(`/businesses/${business.id}`)
    ]);

    setSelectedBusiness(nextBusiness);
    setServices(nextServices);
    setStaffMembers(nextStaffMembers);
    setAppointments(nextAppointments);

    if (nextBusiness.status === "PENDING_ONBOARDING") {
      const readiness = await api.request<PublishReadiness>(`/businesses/${nextBusiness.id}/publish-readiness`);
      setPublishReadiness(readiness);
    } else {
      setPublishReadiness(null);
    }
  }, [api]);

  const refreshCurrentBusiness = useCallback(async () => {
    if (!selectedBusiness) {
      return;
    }

    await loadBusinessData(selectedBusiness);
  }, [loadBusinessData, selectedBusiness]);

  const enterBusiness = useCallback(
    async (business: Business) => {
      await loadBusinessData(business);
      setActiveTab("home");
      setOverlayScreen(null);
      setAuthScreen("businesses");
    },
    [loadBusinessData]
  );

  const enterOwnerArea = useCallback(async () => {
    setAppArea("owner");
    setAuthScreen("businesses");
    setSelectedDiscoveryBusiness(null);
    setClientScreen("home");

    const nextBusinesses = await loadBusinesses();

    if (nextBusinesses.length === 1) {
      await enterBusiness(nextBusinesses[0]);
    }
  }, [enterBusiness, loadBusinesses]);

  const rememberRecentBusiness = useCallback((business: { id: string; name: string }) => {
    setRecentBusinesses((current) => {
      const filtered = current.filter((entry) => entry.id !== business.id);
      return [business, ...filtered].slice(0, 8);
    });
  }, []);

  const loadMyAppointments = useCallback(async () => {
    if (!tokens) {
      return [];
    }

    const nextAppointments = await api.request<ConsumerAppointment[]>("/me/appointments");
    setMyAppointments(nextAppointments);
    return nextAppointments;
  }, [api, tokens]);

  const loadExploreBusinesses = useCallback(
    async (search: string, category: DiscoveryCategoryId | null) => {
      setExploreLoading(true);

      try {
        const query = search.trim();
        const params = new URLSearchParams();

        if (query.length > 0) {
          params.set("search", query);
        }

        if (category) {
          params.set("category", category);
        }

        const suffix = params.toString();
        const results = await api.request<PublicBusinessSummary[]>(
          suffix.length > 0 ? `/discovery/businesses?${suffix}` : "/discovery/businesses"
        );
        setDiscoveredBusinesses(results);
      } finally {
        setExploreLoading(false);
      }
    },
    [api]
  );

  useEffect(() => {
    if (tokens && (consumerTab === "home" || consumerTab === "schedule")) {
      void loadMyAppointments();
    }
  }, [consumerTab, loadMyAppointments, tokens]);

  useEffect(() => {
    if (appArea !== "consumer" || consumerTab !== "explore" || clientScreen !== "home") {
      return;
    }

    const timer = setTimeout(() => {
      void loadExploreBusinesses(exploreSearch, selectedCategory);
    }, 300);

    return () => clearTimeout(timer);
  }, [appArea, clientScreen, consumerTab, exploreSearch, loadExploreBusinesses, selectedCategory]);

  const handleAuthSuccess = useCallback(
    async (nextTokens: AuthTokens, email: string) => {
      setTokens(nextTokens);
      setUserEmail(email);
      setShowAuthPrompt(false);

      const nextBusinesses = await apiFetch<Business[]>("/businesses", {}, nextTokens.accessToken);
      setBusinesses(nextBusinesses);

      if (pendingBookingBusiness) {
        setSelectedDiscoveryBusiness(pendingBookingBusiness);
        setClientScreen("book");
        setConsumerTab("explore");
        setPendingBookingBusiness(null);
      }

      if (pendingProfileAuth) {
        setPendingProfileAuth(false);
        setConsumerTab("profile");
      }
    },
    [pendingBookingBusiness, pendingProfileAuth]
  );

  const openBusinessProfile = useCallback(
    async (businessId: string) => {
      const profile = await api.request<PublicBusinessProfile>(`/discovery/businesses/${businessId}`);
      setSelectedDiscoveryBusiness(profile);
      rememberRecentBusiness({ id: profile.id, name: profile.name });
      setConsumerTab("explore");
      setClientScreen("profile");
    },
    [api, rememberRecentBusiness]
  );

  function startBookingFlow() {
    if (!selectedDiscoveryBusiness) {
      return;
    }

    if (!tokens) {
      setPendingBookingBusiness(selectedDiscoveryBusiness);
      setShowAuthPrompt(true);
      return;
    }

    setClientScreen("book");
  }

  function logout() {
    setTokens(null);
    setUserEmail(null);
    setAppArea("consumer");
    setBusinesses([]);
    setServices([]);
    setStaffMembers([]);
    setAppointments([]);
    setMyAppointments([]);
    setDiscoveredBusinesses([]);
    setSelectedBusiness(null);
    setSelectedDiscoveryBusiness(null);
    setSelectedCategory(null);
    setBookingConfirmation(null);
    setAuthScreen("businesses");
    setClientScreen("home");
    setConsumerTab("profile");
    setActiveTab("home");
    setOverlayScreen(null);
    setMessage(null);
  }

  const showOwnerApp = appArea === "owner" && tokens !== null && selectedBusiness !== null;
  const showOwnerBusinessPicker = appArea === "owner" && tokens !== null && selectedBusiness === null;
  const showConsumerShell = appArea === "consumer";
  const inExploreStack = clientScreen !== "home";

  return (
    <View style={styles.app}>
      <View style={styles.header}>
        <Text style={styles.title}>Zentra</Text>
        {tokens && appArea === "owner" ? <Button title="Sign out" onPress={logout} /> : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? <Text style={styles.loading}>Loading...</Text> : null}

      {showOwnerBusinessPicker ? (
        <BusinessesScreen
          businesses={businesses}
          formatBusinessStatus={formatBusinessStatus}
          formatBusinessType={formatBusinessType}
          onBack={() => {
            setAppArea("consumer");
            setConsumerTab("profile");
          }}
          onCreateBusiness={() => setAuthScreen("create-business")}
          onRefresh={() => void run(async () => {
            await loadBusinesses();
          })}
          onSelectBusiness={(business) => void run(() => enterBusiness(business))}
        />
      ) : null}

      {authScreen === "create-business" && tokens && appArea === "owner" ? (
        <CreateBusinessScreen
          createBusiness={(body) =>
            run(async () => {
              const business = await api.request<Business>("/businesses", {
                body: JSON.stringify(body),
                method: "POST"
              });
              await loadBusinesses();
              await enterBusiness(business);
            }, "Business created")
          }
          onCancel={() => setAuthScreen("businesses")}
        />
      ) : null}

      {showOwnerApp && overlayScreen === "book" ? (
        <BookAppointmentScreen
          businessId={selectedBusiness.id}
          onBack={() => setOverlayScreen(null)}
          refresh={refreshCurrentBusiness}
          request={api.request}
          run={run}
          services={services}
          staffMembers={staffMembers}
          timezone={selectedBusiness.timezone}
        />
      ) : null}

      {showOwnerApp && overlayScreen === "business-hours" ? (
        <BusinessHoursScreen
          businessId={selectedBusiness.id}
          onBack={() => setOverlayScreen(null)}
          request={api.request}
          run={run}
        />
      ) : null}

      {showOwnerApp && overlayScreen === null ? (
        <>
          {activeTab === "home" ? (
            <TodayScreen
              appointments={appointments}
              business={selectedBusiness}
              onBook={() => setOverlayScreen("book")}
              onOpenSettings={() => setActiveTab("settings")}
              publishReadiness={publishReadiness}
              refreshAppointments={() => run(refreshCurrentBusiness)}
              request={api.request}
              run={run}
            />
          ) : null}

          {activeTab === "appointments" ? (
            <AllAppointmentsScreen
              appointments={appointments}
              businessId={selectedBusiness.id}
              onBook={() => setOverlayScreen("book")}
              refreshAppointments={() => run(refreshCurrentBusiness)}
              request={api.request}
              run={run}
              timezone={selectedBusiness.timezone}
            />
          ) : null}

          {activeTab === "services" ? (
            <ServicesScreen
              businessId={selectedBusiness.id}
              refresh={refreshCurrentBusiness}
              request={api.request}
              run={run}
              services={services}
            />
          ) : null}

          {activeTab === "staff" ? (
            <StaffScreen
              businessId={selectedBusiness.id}
              refresh={refreshCurrentBusiness}
              request={api.request}
              run={run}
              staffMembers={staffMembers}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsScreen
              business={selectedBusiness}
              onBrowse={() => {
                setAppArea("consumer");
                setConsumerTab("explore");
              }}
              onOpenBusinessHours={() => setOverlayScreen("business-hours")}
              onPublish={() =>
                void run(async () => {
                  const published = await api.request<Business>(`/businesses/${selectedBusiness.id}/publish`, {
                    method: "POST"
                  });
                  setSelectedBusiness(published);
                  setPublishReadiness(null);
                  await loadBusinesses();
                }, "Your business is now live in Explore")
              }
              onSaveCity={(city) =>
                void run(async () => {
                  const updated = await api.request<Business>(`/businesses/${selectedBusiness.id}`, {
                    body: JSON.stringify({ city: city.trim() || null }),
                    method: "PATCH"
                  });
                  setSelectedBusiness(updated);
                  const readiness = await api.request<PublishReadiness>(
                    `/businesses/${selectedBusiness.id}/publish-readiness`
                  );
                  setPublishReadiness(readiness);
                }, "City saved")
              }
              onSwitchBusiness={() => {
                setSelectedBusiness(null);
                setAuthScreen("businesses");
              }}
              publishReadiness={publishReadiness}
            />
          ) : null}

          <TabBar activeTab={activeTab} onChange={setActiveTab} />
        </>
      ) : null}

      {showConsumerShell && consumerTab === "home" && !inExploreStack ? (
        <ConsumerHomeScreen
          appointments={myAppointments}
          isAuthenticated={tokens !== null}
          onExplore={() => setConsumerTab("explore")}
          onSelectRecentBusiness={(businessId) => void run(() => openBusinessProfile(businessId))}
          onSignIn={() => {
            setPendingProfileAuth(true);
            setShowAuthPrompt(true);
          }}
          onViewSchedule={() => setConsumerTab("schedule")}
          recentBusinesses={recentBusinesses}
          userEmail={userEmail}
        />
      ) : null}

      {showConsumerShell && consumerTab === "explore" ? (
        <>
          {clientScreen === "home" ? (
            <ExploreTabScreen
              businesses={discoveredBusinesses}
              loading={exploreLoading}
              onSearchQueryChange={setExploreSearch}
              onSelectBusiness={(business) =>
                void run(async () => {
                  await openBusinessProfile(business.id);
                })
              }
              onSelectCategory={setSelectedCategory}
              searchQuery={exploreSearch}
              selectedCategory={selectedCategory}
            />
          ) : null}

          {clientScreen === "profile" && selectedDiscoveryBusiness ? (
            <BusinessProfileScreen
              business={selectedDiscoveryBusiness}
              onBack={() => setClientScreen("home")}
              onBook={startBookingFlow}
            />
          ) : null}

          {clientScreen === "book" && selectedDiscoveryBusiness ? (
            <ClientBookAppointmentScreen
              business={selectedDiscoveryBusiness}
              isAuthenticated={tokens !== null}
              onBack={() => setClientScreen("profile")}
              onBooked={(confirmation) => {
                setBookingConfirmation(confirmation);
                setClientScreen("confirmed");
                void loadMyAppointments();
              }}
              onRequireAuth={() => {
                setPendingBookingBusiness(selectedDiscoveryBusiness);
                setShowAuthPrompt(true);
              }}
              request={api.request}
              run={run}
            />
          ) : null}

          {clientScreen === "confirmed" && bookingConfirmation ? (
            <BookingConfirmationScreen
              confirmation={bookingConfirmation}
              onDone={() => {
                setBookingConfirmation(null);
                setClientScreen("home");
                setExploreSearch("");
              }}
              onViewSchedule={() => {
                setBookingConfirmation(null);
                setClientScreen("home");
                setConsumerTab("schedule");
              }}
            />
          ) : null}
        </>
      ) : null}

      {showConsumerShell && consumerTab === "schedule" ? (
        tokens ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            {myAppointments.length === 0 ? (
              <Text style={styles.empty}>You have no upcoming appointments yet.</Text>
            ) : (
              myAppointments.map((appointment) => (
                <ConsumerAppointmentCard key={appointment.id} appointment={appointment} />
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            <Text style={styles.empty}>Sign in to view your appointments.</Text>
            <Pressable
              onPress={() => {
                setPendingProfileAuth(true);
                setShowAuthPrompt(true);
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          </ScrollView>
        )
      ) : null}

      {showConsumerShell && consumerTab === "profile" ? (
        <ProfileTabScreen
          email={userEmail}
          hasBusinesses={businesses.length > 0}
          isAuthenticated={tokens !== null}
          onManageBusinesses={() => {
            if (!tokens) {
              setPendingProfileAuth(true);
              setShowAuthPrompt(true);
              return;
            }

            void run(() => enterOwnerArea());
          }}
          onRecentBusiness={(businessId) => void run(() => openBusinessProfile(businessId))}
          onSignIn={() => {
            setPendingProfileAuth(true);
            setShowAuthPrompt(true);
          }}
          onSignOut={logout}
          recentBusinesses={recentBusinesses}
        />
      ) : null}

      {showConsumerShell ? <ConsumerTabBar activeTab={consumerTab} onChange={setConsumerTab} /> : null}

      <AuthPromptModal
        onClose={() => {
          setShowAuthPrompt(false);
          setPendingBookingBusiness(null);
          setPendingProfileAuth(false);
        }}
        onSubmit={async (mode, email, password) => {
          await run(async () => {
            const data = await apiFetch<AuthTokens>(mode === "register" ? "/auth/register" : "/auth/login", {
              body: JSON.stringify({ email, password }),
              method: "POST"
            });
            await handleAuthSuccess(data, email);
          });
        }}
        visible={showAuthPrompt}
      />

      <StatusBar style="auto" />
    </View>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "appointments", label: "Appointments" },
    { id: "services", label: "Services" },
    { id: "staff", label: "Staff" },
    { id: "settings", label: "Settings" }
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => onChange(tab.id)}
          style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
        >
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

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
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
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

function TodayScreen({
  appointments,
  business,
  onBook,
  onOpenSettings,
  publishReadiness,
  refreshAppointments,
  request,
  run
}: {
  appointments: Appointment[];
  business: Business;
  onBook: () => void;
  onOpenSettings: () => void;
  publishReadiness: PublishReadiness | null;
  refreshAppointments: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
}) {
  const todayKey = getDateKeyInTimeZone(new Date(), business.timezone);
  const todayAppointments = sortAppointmentsChronologically(
    appointments.filter((appointment) => isAppointmentOnDate(appointment, todayKey, business.timezone))
  );
  const completedCount = todayAppointments.filter((appointment) => appointment.status === "COMPLETED").length;
  const remainingCount = todayAppointments.filter((appointment) => appointment.status === "BOOKED").length;

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      {publishReadiness && business.status === "PENDING_ONBOARDING" ? (
        <Pressable onPress={onOpenSettings} style={styles.publishBanner}>
          <Text style={styles.publishBannerTitle}>Finish setup to appear in Explore</Text>
          <Text style={styles.publishBannerText}>
            {publishReadiness.canPublish
              ? "Everything is ready. Go live so customers can find you."
              : publishReadiness.missingSteps.join(" · ")}
          </Text>
          <Text style={styles.publishBannerLink}>Open setup checklist</Text>
        </Pressable>
      ) : null}

      <View style={styles.todayHeader}>
        <Text style={styles.todayDate}>{formatTodayHeading(business.timezone)}</Text>
        <Text style={styles.todayBusinessName}>{business.name}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayAppointments.length}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{remainingCount}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today&apos;s schedule</Text>
        <Button title="Refresh" onPress={() => void refreshAppointments()} />
      </View>

      {todayAppointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>You have no appointments today.</Text>
          <Pressable onPress={onBook} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Book Appointment</Text>
          </Pressable>
        </View>
      ) : (
        todayAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              businessId={business.id}
              compact
              onActionComplete={refreshAppointments}
              request={request}
              run={run}
              timezone={business.timezone}
            />
        ))
      )}
    </ScrollView>
  );
}

function AllAppointmentsScreen({
  appointments,
  businessId,
  onBook,
  refreshAppointments,
  request,
  run,
  timezone
}: {
  appointments: Appointment[];
  businessId: string;
  onBook: () => void;
  refreshAppointments: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  timezone: string;
}) {
  const sortedAppointments = sortAppointmentsChronologically(appointments);

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>All appointments</Text>
        <Button title="Refresh" onPress={() => void refreshAppointments()} />
      </View>

      <Pressable onPress={onBook} style={[styles.primaryButton, styles.inlinePrimaryButton]}>
        <Text style={styles.primaryButtonText}>Book Appointment</Text>
      </Pressable>

      {sortedAppointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No appointments yet.</Text>
          <Text style={styles.emptyStateBody}>Book your first appointment to get started.</Text>
        </View>
      ) : (
        sortedAppointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            businessId={businessId}
            onActionComplete={refreshAppointments}
            request={request}
            run={run}
            timezone={timezone}
          />
        ))
      )}
    </ScrollView>
  );
}

export function buildBookAppointmentPayload(input: {
  clientId: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
}): {
  clientId: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
} {
  return {
    clientId: input.clientId,
    serviceId: input.serviceId,
    staffMemberId: input.staffMemberId,
    startTime: input.startTime
  };
}

export function BookAppointmentScreen({
  businessId,
  onBack,
  refresh,
  request,
  run,
  services,
  staffMembers,
  timezone
}: {
  businessId: string;
  onBack: () => void;
  refresh: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  services: BusinessService[];
  staffMembers: StaffMember[];
  timezone: string;
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

function SettingsScreen({
  business,
  onBrowse,
  onOpenBusinessHours,
  onPublish,
  onSaveCity,
  onSwitchBusiness,
  publishReadiness
}: {
  business: Business;
  onBrowse: () => void;
  onOpenBusinessHours: () => void;
  onPublish: () => void;
  onSaveCity: (city: string) => void;
  onSwitchBusiness: () => void;
  publishReadiness: PublishReadiness | null;
}) {
  const [cityDraft, setCityDraft] = useState(business.city ?? "");

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Settings</Text>

      {publishReadiness && business.status === "PENDING_ONBOARDING" ? (
        <View style={styles.publishCard}>
          <Text style={styles.publishCardTitle}>Go live in Explore</Text>
          <Text style={styles.publishCardText}>
            Customers cannot discover your business until setup is complete and you publish.
          </Text>
          <View style={styles.checklist}>
            <Text style={publishReadiness.requirements.hasService ? styles.checklistDone : styles.checklistPending}>
              {publishReadiness.requirements.hasService ? "✓" : "○"} At least one service
            </Text>
            <Text style={publishReadiness.requirements.hasStaff ? styles.checklistDone : styles.checklistPending}>
              {publishReadiness.requirements.hasStaff ? "✓" : "○"} At least one staff member
            </Text>
            <Text style={publishReadiness.requirements.hasCity ? styles.checklistDone : styles.checklistPending}>
              {publishReadiness.requirements.hasCity ? "✓" : "○"} City for discovery
            </Text>
          </View>
          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            onChangeText={setCityDraft}
            placeholder="e.g. Amman"
            style={styles.input}
            value={cityDraft}
          />
          <Pressable onPress={() => onSaveCity(cityDraft)} style={[styles.primaryButton, styles.inlinePrimaryButton]}>
            <Text style={styles.primaryButtonText}>Save city</Text>
          </Pressable>
          <Pressable
            disabled={!publishReadiness.canPublish}
            onPress={onPublish}
            style={[styles.primaryButton, !publishReadiness.canPublish && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Publish business</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Business</Text>
        <Text style={styles.settingsValue}>{business.name}</Text>
        <Text style={styles.settingsMeta}>{formatBusinessType(business.businessType)}</Text>
        <Text style={styles.settingsMeta}>Status: {formatBusinessStatus(business.status)}</Text>
        <Text style={styles.settingsMeta}>Timezone: {business.timezone.replaceAll("_", " ")}</Text>
      </View>

      <Pressable onPress={onBrowse} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Browse businesses</Text>
      </Pressable>

      <Pressable onPress={onOpenBusinessHours} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Business hours</Text>
      </Pressable>

      <Pressable onPress={onSwitchBusiness} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Switch business</Text>
      </Pressable>
    </ScrollView>
  );
}

export function ClientBrowseHomeScreen({
  onSearch,
  onSearchQueryChange,
  onSelectCategory,
  searchQuery
}: {
  onSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelectCategory: (category: DiscoveryCategoryId) => void;
  searchQuery: string;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Explore</Text>
      <TextInput
        onChangeText={onSearchQueryChange}
        onSubmitEditing={onSearch}
        placeholder="Search by business name"
        returnKeyType="search"
        style={styles.input}
        value={searchQuery}
      />
      <Pressable onPress={onSearch} style={[styles.primaryButton, styles.inlinePrimaryButton]}>
        <Text style={styles.primaryButtonText}>Search</Text>
      </Pressable>
      <Text style={styles.fieldLabel}>Categories</Text>
      {DISCOVERY_CATEGORY_OPTIONS.map((category) => (
        <Pressable key={category.id} onPress={() => onSelectCategory(category.id)} style={styles.card}>
          <Text style={styles.cardTitle}>{category.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function CategoryBusinessListScreen({
  businesses,
  categoryLabel,
  onBack,
  onSelectBusiness
}: {
  businesses: PublicBusinessSummary[];
  categoryLabel: string;
  onBack: () => void;
  onSelectBusiness: (business: PublicBusinessSummary) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{categoryLabel}</Text>
      <Button title="Back" onPress={onBack} />
      {businesses.length === 0 ? (
        <Text style={styles.empty}>No businesses found in this category yet.</Text>
      ) : (
        businesses.map((business) => {
          const locationLabel = formatBusinessLocation(business.city, business.address);

          return (
            <Pressable key={business.id} onPress={() => onSelectBusiness(business)} style={styles.card}>
              <Text style={styles.cardTitle}>{business.name}</Text>
              <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
              {locationLabel ? <Text style={styles.cardMeta}>{locationLabel}</Text> : null}
              <Text style={styles.linkButtonText}>View</Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

export function BusinessProfileScreen({
  business,
  onBack,
  onBook
}: {
  business: PublicBusinessProfile;
  onBack: () => void;
  onBook: () => void;
}) {
  const locationLabel = formatBusinessLocation(business.city, business.address);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{business.name}</Text>
      <Button title="Back" onPress={onBack} />
      <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
      {locationLabel ? <Text style={styles.cardMeta}>{locationLabel}</Text> : null}
      <Text style={styles.fieldLabel}>Hours</Text>
      <Text style={styles.cardMeta}>{formatBusinessHoursSummary(business.businessHours)}</Text>
      <Text style={styles.fieldLabel}>Services</Text>
      {business.services.length === 0 ? (
        <Text style={styles.empty}>No services available yet.</Text>
      ) : (
        business.services.map((service) => (
          <View key={service.id} style={styles.selectionButton}>
            <Text style={styles.selectionButtonTitle}>{service.name}</Text>
            <Text style={styles.selectionButtonMeta}>
              {service.durationMinutes} min
              {formatServicePriceLabel(service.price) ? ` · ${formatServicePriceLabel(service.price)}` : ""}
            </Text>
          </View>
        ))
      )}
      <Text style={styles.fieldLabel}>Staff</Text>
      {business.staff.length === 0 ? (
        <Text style={styles.empty}>No staff listed yet.</Text>
      ) : (
        business.staff.map((staffMember) => (
          <View key={staffMember.id} style={styles.selectionButton}>
            <Text style={styles.selectionButtonTitle}>{staffMember.displayName}</Text>
          </View>
        ))
      )}
      <Pressable onPress={onBook} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Book appointment</Text>
      </Pressable>
    </ScrollView>
  );
}

function BusinessesScreen({
  businesses,
  formatBusinessStatus,
  formatBusinessType,
  onBack,
  onCreateBusiness,
  onRefresh,
  onSelectBusiness
}: {
  businesses: Business[];
  formatBusinessStatus: (status: string) => string;
  formatBusinessType: (businessType: string) => string;
  onBack: () => void;
  onCreateBusiness: () => void;
  onRefresh: () => void;
  onSelectBusiness: (business: Business) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Your businesses</Text>
      <Button title="Back" onPress={onBack} />
      <View style={styles.row}>
        <Button title="Refresh" onPress={onRefresh} />
        <Button title="Create business" onPress={onCreateBusiness} />
      </View>
      {businesses.map((business) => (
        <Pressable key={business.id} onPress={() => onSelectBusiness(business)} style={styles.card}>
          <Text style={styles.cardTitle}>{business.name}</Text>
          <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
          <Text style={styles.cardMeta}>{formatBusinessStatus(business.status)}</Text>
        </Pressable>
      ))}
      {businesses.length === 0 ? <Text style={styles.empty}>Create your first business to get started.</Text> : null}
    </ScrollView>
  );
}

function CreateBusinessScreen({
  createBusiness,
  onCancel
}: {
  createBusiness: (body: { businessType: string; name: string; timezone: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("BARBER");
  const [timezone, setTimezone] = useState("Asia/Jerusalem");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Create business</Text>
      <TextInput onChangeText={setName} placeholder="Business name" style={styles.input} value={name} />
      <Text style={styles.fieldLabel}>Business type</Text>
      <View style={styles.chipRow}>
        {BUSINESS_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => setBusinessType(type)}
            style={[styles.chip, businessType === type && styles.chipSelected]}
          >
            <Text style={[styles.chipText, businessType === type && styles.chipTextSelected]}>
              {formatBusinessType(type)}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput onChangeText={setTimezone} placeholder="Timezone" style={styles.input} value={timezone} />
      <View style={styles.row}>
        <Button title="Cancel" onPress={onCancel} />
        <Button title="Create" onPress={() => void createBusiness({ businessType, name, timezone })} />
      </View>
    </ScrollView>
  );
}

function ServicesScreen({
  businessId,
  refresh,
  request,
  run,
  services
}: {
  businessId: string;
  refresh: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  services: BusinessService[];
}) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [price, setPrice] = useState("");

  function useService(service: BusinessService) {
    setSelectedServiceId(service.id);
    setName(service.name);
    setDescription(service.description);
    setDurationMinutes(String(service.durationMinutes));
    setPrice(formatServicePriceLabel(service.price) ?? "");
  }

  async function saveService(method: "POST" | "PATCH") {
    const path = method === "POST" ? `/businesses/${businessId}/services` : `/businesses/${businessId}/services/${selectedServiceId}`;
    const body: Record<string, unknown> = {
      description,
      durationMinutes: Number(durationMinutes),
      name
    };

    if (method === "PATCH") {
      body.price = price.trim() === "" ? null : Number(price);
    } else if (price.trim() !== "") {
      body.price = Number(price);
    }

    await run(async () => {
      await request<BusinessService>(path, {
        body: JSON.stringify(body),
        method
      });
      await refresh();
      setSelectedServiceId("");
    }, method === "POST" ? "Service created" : "Service updated");
  }

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Services</Text>
      <TextInput onChangeText={setName} placeholder="Service name" style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" style={styles.input} value={description} />
      <TextInput keyboardType="number-pad" onChangeText={setDurationMinutes} placeholder="Duration (minutes)" style={styles.input} value={durationMinutes} />
      <TextInput keyboardType="decimal-pad" onChangeText={setPrice} placeholder="Price (optional)" style={styles.input} value={price} />
      <View style={styles.row}>
        <Button title="Create" onPress={() => void saveService("POST")} />
        <Button title="Update selected" onPress={() => void saveService("PATCH")} />
      </View>
      {services.map((service) => (
        <View key={service.id} style={styles.card}>
          <Text style={styles.cardTitle}>{service.name}</Text>
          <Text style={styles.cardMeta}>{service.description}</Text>
          <Text style={styles.cardMeta}>
            {service.durationMinutes} min
            {formatServicePriceLabel(service.price) ? ` · ${formatServicePriceLabel(service.price)}` : ""}
          </Text>
          <Text style={styles.cardMeta}>{service.active ? "Active" : "Inactive"}</Text>
          <View style={styles.row}>
            <Button title="Edit" onPress={() => useService(service)} />
            <Button title="Deactivate" onPress={() => void run(async () => {
              await request<BusinessService>(`/businesses/${businessId}/services/${service.id}/deactivate`, { method: "POST" });
              await refresh();
            }, "Service deactivated")} />
          </View>
        </View>
      ))}
      {services.length === 0 ? <Text style={styles.empty}>Add your first service above.</Text> : null}
    </ScrollView>
  );
}

function StaffScreen({
  businessId,
  refresh,
  request,
  run,
  staffMembers
}: {
  businessId: string;
  refresh: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  staffMembers: StaffMember[];
}) {
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  function useStaffMember(staffMember: StaffMember) {
    setSelectedStaffMemberId(staffMember.id);
    setDisplayName(staffMember.displayName);
  }

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Staff</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setUserEmail}
        placeholder="Staff account email"
        style={styles.input}
        value={userEmail}
      />
      <TextInput onChangeText={setDisplayName} placeholder="Display name" style={styles.input} value={displayName} />
      <View style={styles.row}>
        <Button title="Add staff" onPress={() => void run(async () => {
          await request<StaffMember>(`/businesses/${businessId}/staff`, {
            body: JSON.stringify({ displayName, userEmail }),
            method: "POST"
          });
          await refresh();
          setUserEmail("");
          setDisplayName("");
        }, "Staff member added")} />
        <Button title="Update selected" onPress={() => void run(async () => {
          await request<StaffMember>(`/businesses/${businessId}/staff/${selectedStaffMemberId}`, {
            body: JSON.stringify({ displayName }),
            method: "PATCH"
          });
          await refresh();
        }, "Staff member updated")} />
      </View>
      {staffMembers.map((staffMember) => (
        <View key={staffMember.id} style={styles.card}>
          <Text style={styles.cardTitle}>{staffMember.displayName}</Text>
          <Text style={styles.cardMeta}>{staffMember.active ? "Active" : "Inactive"}</Text>
          <View style={styles.row}>
            <Button title="Edit" onPress={() => useStaffMember(staffMember)} />
            <Button title="Deactivate" onPress={() => void run(async () => {
              await request<StaffMember>(`/businesses/${businessId}/staff/${staffMember.id}/deactivate`, { method: "POST" });
              await refresh();
            }, "Staff member deactivated")} />
          </View>
        </View>
      ))}
      {staffMembers.length === 0 ? <Text style={styles.empty}>Add your first team member above.</Text> : null}
    </ScrollView>
  );
}

function BusinessHoursScreen({
  businessId,
  onBack,
  request,
  run
}: {
  businessId: string;
  onBack: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
}) {
  const [hours, setHours] = useState<BusinessHour[]>([]);

  useEffect(() => {
    void request<BusinessHour[]>(`/businesses/${businessId}/business-hours`).then(setHours);
  }, [businessId, request]);

  function updateHour(dayOfWeek: number, changes: Partial<BusinessHour>) {
    setHours((currentHours) =>
      currentHours.map((hour) => (hour.dayOfWeek === dayOfWeek ? { ...hour, ...changes } : hour))
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Business hours</Text>
      <Button title="Back" onPress={onBack} />
      {hours.map((hour) => (
        <View key={hour.dayOfWeek} style={styles.card}>
          <Text style={styles.cardTitle}>{DAY_NAMES[hour.dayOfWeek]}</Text>
          <View style={styles.row}>
            <Button
              title={hour.isClosed ? "Closed" : "Open"}
              onPress={() =>
                updateHour(hour.dayOfWeek, {
                  closeTime: hour.isClosed ? "17:00" : null,
                  isClosed: !hour.isClosed,
                  openTime: hour.isClosed ? "09:00" : null
                })
              }
            />
          </View>
          {hour.isClosed ? (
            <Text style={styles.cardMeta}>Closed all day</Text>
          ) : (
            <>
              <TextInput
                onChangeText={(openTime) => updateHour(hour.dayOfWeek, { openTime })}
                placeholder="Open (HH:MM)"
                style={styles.input}
                value={hour.openTime ?? ""}
              />
              <TextInput
                onChangeText={(closeTime) => updateHour(hour.dayOfWeek, { closeTime })}
                placeholder="Close (HH:MM)"
                style={styles.input}
                value={hour.closeTime ?? ""}
              />
            </>
          )}
        </View>
      ))}
      <Pressable
        onPress={() =>
          void run(async () => {
            await request<BusinessHour[]>(`/businesses/${businessId}/business-hours`, {
              body: JSON.stringify({
                hours: hours.map((hour) => ({
                  closeTime: hour.isClosed ? undefined : hour.closeTime,
                  dayOfWeek: hour.dayOfWeek,
                  isClosed: hour.isClosed,
                  openTime: hour.isClosed ? undefined : hour.openTime
                }))
              }),
              method: "PUT"
            });
          }, "Business hours saved")
        }
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Save business hours</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  actionButtonPrimary: {
    backgroundColor: "#2563eb"
  },
  actionButtonPrimaryText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  actionButtonSecondary: {
    backgroundColor: "#e2e8f0"
  },
  actionButtonSecondaryText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  app: {
    backgroundColor: "#f8fafc",
    flex: 1,
    padding: 16
  },
  appointmentCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16
  },
  appointmentCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  appointmentClient: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4
  },
  appointmentMeta: {
    color: "#475569",
    fontSize: 14,
    marginTop: 2
  },
  appointmentTime: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600"
  },
  authSubtitle: {
    color: "#64748b",
    marginBottom: 12
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16
  },
  cardMeta: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700"
  },
  chip: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8
  },
  chipSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#2563eb"
  },
  chipText: {
    color: "#334155",
    fontSize: 13
  },
  chipTextSelected: {
    color: "#1d4ed8",
    fontWeight: "600"
  },
  content: {
    paddingBottom: 24
  },
  contentWithTabs: {
    paddingBottom: 88
  },
  empty: {
    color: "#64748b",
    marginTop: 16
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 24
  },
  emptyStateBody: {
    color: "#64748b",
    marginTop: 8,
    textAlign: "center"
  },
  emptyStateTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
  },
  checklist: {
    gap: 8,
    marginTop: 12
  },
  checklistDone: {
    color: "#166534",
    fontWeight: "600"
  },
  checklistPending: {
    color: "#64748b"
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
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16
  },
  halfButton: {
    flex: 1
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  inlinePrimaryButton: {
    marginTop: 12
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12
  },
  loading: {
    color: "#2563eb",
    marginBottom: 8
  },
  message: {
    color: "#b45309",
    marginBottom: 8
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 16,
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
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8
  },
  selectionButton: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    padding: 12
  },
  selectionButtonMeta: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 4
  },
  selectionButtonSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb"
  },
  selectedClientBanner: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    padding: 12
  },
  linkButton: {
    marginTop: 8
  },
  linkButtonText: {
    color: "#2563eb",
    fontWeight: "600"
  },
  selectionButtonTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  settingsAction: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16
  },
  settingsActionText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600"
  },
  settingsCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    padding: 16
  },
  settingsLabel: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 4
  },
  settingsMeta: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4
  },
  settingsValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700"
  },
  publishBanner: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },
  publishBannerLink: {
    color: "#c2410c",
    fontWeight: "700",
    marginTop: 10
  },
  publishBannerText: {
    color: "#9a3412",
    lineHeight: 20,
    marginTop: 6
  },
  publishBannerTitle: {
    color: "#9a3412",
    fontSize: 16,
    fontWeight: "700"
  },
  publishCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },
  publishCardText: {
    color: "#9a3412",
    lineHeight: 20,
    marginTop: 8
  },
  publishCardTitle: {
    color: "#9a3412",
    fontSize: 18,
    fontWeight: "700"
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
  statCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 16
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4
  },
  statValue: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700"
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusBadgeBooked: {
    backgroundColor: "#dbeafe"
  },
  statusBadgeCancelled: {
    backgroundColor: "#fee2e2"
  },
  statusBadgeCompleted: {
    backgroundColor: "#dcfce7"
  },
  statusBadgeText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600"
  },
  tabBar: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 8,
    position: "absolute",
    right: 0
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 8
  },
  tabButtonActive: {
    backgroundColor: "#eff6ff",
    borderRadius: 8
  },
  tabLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600"
  },
  tabLabelActive: {
    color: "#2563eb"
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700"
  },
  todayBusinessName: {
    color: "#475569",
    fontSize: 16,
    marginTop: 4
  },
  todayDate: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700"
  },
  todayHeader: {
    marginTop: 4
  }
});
