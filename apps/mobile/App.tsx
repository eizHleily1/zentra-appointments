import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Text, View } from "react-native";
import { AuthPromptModal } from "./components/AuthPromptModal";
import { ConsumerTabBar, type ConsumerTab } from "./components/ConsumerTabBar";
import { OwnerTabBar } from "./components/OwnerTabBar";
import { apiFetch, createApiClient } from "./lib/api";
import { isBusinessBookable } from "./lib/business-profile";
import { formatBusinessStatus, formatBusinessType } from "./lib/formatters";
import { styles } from "./lib/styles";
import type {
  AppArea,
  Appointment,
  AuthTokens,
  BookingConfirmationDetails,
  BookingInitialClient,
  Business,
  BusinessService,
  ClientScreen,
  ConsumerAppointment,
  DiscoveryCategoryId,
  OverlayScreen,
  PublicBusinessProfile,
  PublicBusinessSummary,
  PublishReadiness,
  StaffMember,
  Tab
} from "./lib/types";
import { BookingConfirmationScreen } from "./screens/consumer/BookingConfirmationScreen";
import { BusinessProfileScreen } from "./screens/consumer/BusinessProfileScreen";
import { ClientBookAppointmentScreen } from "./screens/consumer/ClientBookAppointmentScreen";
import { ConsumerHomeScreen } from "./screens/consumer/ConsumerHomeScreen";
import { ExploreTabScreen } from "./screens/consumer/ExploreTabScreen";
import { ProfileTabScreen } from "./screens/consumer/ProfileTabScreen";
import { ScheduleTabScreen } from "./screens/consumer/ScheduleTabScreen";
import { OwnerAppointmentDetailScreen } from "./screens/owner/OwnerAppointmentDetailScreen";
import { AllAppointmentsScreen } from "./screens/owner/AllAppointmentsScreen";
import { BookAppointmentScreen } from "./screens/owner/BookAppointmentScreen";
import { BusinessHoursScreen } from "./screens/owner/BusinessHoursScreen";
import { BusinessesScreen } from "./screens/owner/BusinessesScreen";
import { CreateBusinessScreen } from "./screens/owner/CreateBusinessScreen";
import { ServicesScreen } from "./screens/owner/ServicesScreen";
import { SettingsScreen } from "./screens/owner/SettingsScreen";
import { StaffScreen } from "./screens/owner/StaffScreen";
import { ClientsScreen } from "./screens/owner/ClientsScreen";
import { TodayScreen } from "./screens/owner/TodayScreen";

export { getDateKeyInTimeZone, isAppointmentOnDate, sortAppointmentsChronologically } from "./lib/appointments";
export { formatBusinessHoursSummary } from "./lib/business-hours";
export { DISCOVERY_CATEGORY_OPTIONS } from "./lib/constants";
export {
  formatAppointmentStatus,
  formatAppointmentTimeOnly,
  formatAppointmentTimeRange,
  formatBusinessLocation,
  formatBusinessStatus,
  formatBusinessType,
  formatClientPhoneLabel,
  formatServicePriceLabel,
  formatTodayHeading
} from "./lib/formatters";
export type { DiscoveryCategoryId } from "./lib/types";
export { AppointmentListCard } from "./components/AppointmentListCard";
export { BusinessCard } from "./components/BusinessCard";
export { buildBookAppointmentPayload, BookAppointmentScreen } from "./screens/owner/BookAppointmentScreen";
export { CategoryBusinessListScreen } from "./screens/consumer/CategoryBusinessListScreen";
export { BusinessProfileScreen } from "./screens/consumer/BusinessProfileScreen";
export { buildConsumerBookAppointmentPayload, ClientBookAppointmentScreen } from "./screens/consumer/ClientBookAppointmentScreen";
export { ConsumerAppointmentCard } from "./components/ConsumerAppointmentCard";

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
  const [bookingInitialClient, setBookingInitialClient] = useState<BookingInitialClient | null>(null);
  const [selectedOwnerAppointment, setSelectedOwnerAppointment] = useState<Appointment | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const api = useMemo(() => createApiClient(tokens?.accessToken ?? null), [tokens]);

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
    if (!selectedDiscoveryBusiness || !isBusinessBookable(selectedDiscoveryBusiness)) {
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
    setBookingInitialClient(null);
    setSelectedOwnerAppointment(null);
    setMessage(null);
  }

  const openBookAppointment = useCallback((client?: BookingInitialClient) => {
    setBookingInitialClient(client ?? null);
    setOverlayScreen("book");
  }, []);

  const closeBookAppointment = useCallback(() => {
    setOverlayScreen(null);
    setBookingInitialClient(null);
  }, []);

  const openOwnerAppointmentDetail = useCallback((appointment: Appointment) => {
    setSelectedOwnerAppointment(appointment);
    setOverlayScreen("owner-appointment-detail");
  }, []);

  const closeOwnerAppointmentDetail = useCallback(() => {
    setOverlayScreen(null);
    setSelectedOwnerAppointment(null);
  }, []);

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
          onRefresh={() =>
            void run(async () => {
              await loadBusinesses();
            })
          }
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

      {showOwnerApp && overlayScreen === "owner-appointment-detail" && selectedOwnerAppointment && selectedBusiness ? (
        <OwnerAppointmentDetailScreen
          appointmentId={selectedOwnerAppointment.id}
          businessId={selectedBusiness.id}
          initialAppointment={selectedOwnerAppointment}
          onActionComplete={refreshCurrentBusiness}
          onBack={closeOwnerAppointmentDetail}
          onBookForClient={(client) => {
            closeOwnerAppointmentDetail();
            openBookAppointment(client);
          }}
          request={api.request}
          run={run}
          timezone={selectedBusiness.timezone}
        />
      ) : null}

      {showOwnerApp && overlayScreen === "book" ? (
        <BookAppointmentScreen
          businessId={selectedBusiness.id}
          initialClient={bookingInitialClient ?? undefined}
          onBack={closeBookAppointment}
          refresh={refreshCurrentBusiness}
          request={api.request}
          run={run}
          services={services}
          staffMembers={staffMembers}
        />
      ) : null}

      {showOwnerApp && overlayScreen === "services" ? (
        <ServicesScreen
          businessId={selectedBusiness.id}
          onBack={() => setOverlayScreen(null)}
          refresh={refreshCurrentBusiness}
          request={api.request}
          run={run}
          services={services}
        />
      ) : null}

      {showOwnerApp && overlayScreen === "staff" ? (
        <StaffScreen
          businessId={selectedBusiness.id}
          onBack={() => setOverlayScreen(null)}
          refresh={refreshCurrentBusiness}
          request={api.request}
          run={run}
          staffMembers={staffMembers}
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
              onBook={() => openBookAppointment()}
              onOpenSettings={() => setActiveTab("settings")}
              onSelectAppointment={openOwnerAppointmentDetail}
              publishReadiness={publishReadiness}
              refreshAppointments={() => run(refreshCurrentBusiness)}
            />
          ) : null}

          {activeTab === "appointments" ? (
            <AllAppointmentsScreen
              appointments={appointments}
              onBook={() => openBookAppointment()}
              onSelectAppointment={openOwnerAppointmentDetail}
              refreshAppointments={() => run(refreshCurrentBusiness)}
              timezone={selectedBusiness.timezone}
            />
          ) : null}

          {activeTab === "clients" ? (
            <ClientsScreen
              businessId={selectedBusiness.id}
              onBookAppointment={openBookAppointment}
              request={api.request}
              run={run}
              timezone={selectedBusiness.timezone}
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
              onOpenServices={() => setOverlayScreen("services")}
              onOpenStaff={() => setOverlayScreen("staff")}
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

          <OwnerTabBar activeTab={activeTab} onChange={setActiveTab} />
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
        <ScheduleTabScreen
          isActive={consumerTab === "schedule"}
          isAuthenticated={tokens !== null}
          onBookAgain={(businessId) => void run(() => openBusinessProfile(businessId))}
          onSignIn={() => {
            setPendingProfileAuth(true);
            setShowAuthPrompt(true);
          }}
          request={api.request}
        />
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
          onRecentBusiness={(businessId: string) => void run(() => openBusinessProfile(businessId))}
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
