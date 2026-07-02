import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

type Screen = "auth" | "businesses" | "create-business" | "dashboard" | "services" | "staff" | "appointments";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

interface Business {
  businessType: string;
  id: string;
  name: string;
  status: string;
  timezone: string;
}

interface BusinessService {
  active: boolean;
  businessId: string;
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
  price: number;
}

interface StaffMember {
  active: boolean;
  businessId: string;
  displayName: string;
  id: string;
  userId: string;
}

interface Appointment {
  businessId: string;
  clientUserId: string;
  endsAt: string;
  id: string;
  serviceDurationMinutes: number;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  staffDisplayName: string;
  staffMemberId: string;
  startsAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
}

const API_URL = process.env?.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const BUSINESS_TYPES = ["BARBER", "SALON", "NAIL_ARTIST", "THERAPIST", "CLINIC", "COACH", "PERSONAL_TRAINER", "CONSULTANT", "OTHER"];

export default function App() {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [screen, setScreen] = useState<Screen>("auth");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const api = useMemo(() => {
    async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {}),
          ...(options.headers ?? {})
        }
      });
      const text = await response.text();
      const data = text.length > 0 ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new Error(data?.message ?? "Request failed");
      }

      return data as T;
    }

    return { request };
  }, [tokens]);

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
    const nextBusinesses = await api.request<Business[]>("/businesses");
    setBusinesses(nextBusinesses);
  }, [api]);

  const loadBusinessData = useCallback(async (business: Business) => {
    const [nextServices, nextStaffMembers, nextAppointments] = await Promise.all([
      api.request<BusinessService[]>(`/businesses/${business.id}/services`),
      api.request<StaffMember[]>(`/businesses/${business.id}/staff`),
      api.request<Appointment[]>(`/businesses/${business.id}/appointments`)
    ]);

    setSelectedBusiness(business);
    setServices(nextServices);
    setStaffMembers(nextStaffMembers);
    setAppointments(nextAppointments);
  }, [api]);

  function selectBusiness(business: Business) {
    void run(async () => {
      await loadBusinessData(business);
      setScreen("dashboard");
    });
  }

  function logout() {
    setTokens(null);
    setBusinesses([]);
    setServices([]);
    setStaffMembers([]);
    setAppointments([]);
    setSelectedBusiness(null);
    setScreen("auth");
    setMessage(null);
  }

  return (
    <View style={styles.app}>
      <View style={styles.header}>
        <Text style={styles.title}>Zentra MVP</Text>
        {tokens ? <Button title="Logout" onPress={logout} /> : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? <Text style={styles.loading}>Loading...</Text> : null}

      {screen === "auth" ? (
        <AuthScreen
          onLogin={(nextTokens) => {
            setTokens(nextTokens);
            setScreen("businesses");
            void run(loadBusinesses);
          }}
          run={run}
        />
      ) : null}

      {screen === "businesses" ? (
        <BusinessesScreen
          businesses={businesses}
          onCreateBusiness={() => setScreen("create-business")}
          onRefresh={() => void run(loadBusinesses)}
          onSelectBusiness={selectBusiness}
        />
      ) : null}

      {screen === "create-business" ? (
        <CreateBusinessScreen
          createBusiness={(body) =>
            run(async () => {
              await api.request<Business>("/businesses", {
                body: JSON.stringify(body),
                method: "POST"
              });
              await loadBusinesses();
              setScreen("businesses");
            }, "Business created")
          }
          onCancel={() => setScreen("businesses")}
        />
      ) : null}

      {screen === "dashboard" && selectedBusiness ? (
        <BusinessDashboardScreen
          appointments={appointments}
          business={selectedBusiness}
          onBack={() => setScreen("businesses")}
          onRefresh={() => void run(() => loadBusinessData(selectedBusiness))}
          onShowAppointments={() => setScreen("appointments")}
          onShowServices={() => setScreen("services")}
          onShowStaff={() => setScreen("staff")}
          services={services}
          staffMembers={staffMembers}
        />
      ) : null}

      {screen === "services" && selectedBusiness ? (
        <ServicesScreen
          businessId={selectedBusiness.id}
          refresh={() => loadBusinessData(selectedBusiness)}
          request={api.request}
          run={run}
          services={services}
          showDashboard={() => setScreen("dashboard")}
        />
      ) : null}

      {screen === "staff" && selectedBusiness ? (
        <StaffScreen
          businessId={selectedBusiness.id}
          refresh={() => loadBusinessData(selectedBusiness)}
          request={api.request}
          run={run}
          showDashboard={() => setScreen("dashboard")}
          staffMembers={staffMembers}
        />
      ) : null}

      {screen === "appointments" && selectedBusiness ? (
        <AppointmentsScreen
          appointments={appointments}
          businessId={selectedBusiness.id}
          refresh={() => loadBusinessData(selectedBusiness)}
          request={api.request}
          run={run}
          services={services}
          showDashboard={() => setScreen("dashboard")}
          staffMembers={staffMembers}
        />
      ) : null}

      <StatusBar style="auto" />
    </View>
  );
}

function AuthScreen({
  onLogin,
  run
}: {
  onLogin: (tokens: AuthTokens) => void;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function authenticate(path: "/auth/register" | "/auth/login") {
    await run(async () => {
      const response = await fetch(`${API_URL}${path}`, {
        body: JSON.stringify({ email, password }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Authentication failed");
      }

      onLogin(data as AuthTokens);
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Auth</Text>
      <TextInput autoCapitalize="none" onChangeText={setEmail} placeholder="Email" style={styles.input} value={email} />
      <TextInput onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} value={password} />
      <View style={styles.row}>
        <Button title="Register" onPress={() => void authenticate("/auth/register")} />
        <Button title="Login" onPress={() => void authenticate("/auth/login")} />
      </View>
    </ScrollView>
  );
}

function BusinessesScreen({
  businesses,
  onCreateBusiness,
  onRefresh,
  onSelectBusiness
}: {
  businesses: Business[];
  onCreateBusiness: () => void;
  onRefresh: () => void;
  onSelectBusiness: (business: Business) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>My Businesses</Text>
      <View style={styles.row}>
        <Button title="Refresh" onPress={onRefresh} />
        <Button title="Create Business" onPress={onCreateBusiness} />
      </View>
      {businesses.map((business) => (
        <Pressable key={business.id} onPress={() => onSelectBusiness(business)} style={styles.card}>
          <Text style={styles.cardTitle}>{business.name}</Text>
          <Text>{business.businessType}</Text>
          <Text>{business.status}</Text>
        </Pressable>
      ))}
      {businesses.length === 0 ? <Text style={styles.empty}>No businesses yet.</Text> : null}
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
  const [timezone, setTimezone] = useState("Asia/Amman");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Create Business</Text>
      <TextInput onChangeText={setName} placeholder="Business name" style={styles.input} value={name} />
      <TextInput onChangeText={setBusinessType} placeholder={BUSINESS_TYPES.join(", ")} style={styles.input} value={businessType} />
      <TextInput onChangeText={setTimezone} placeholder="Timezone" style={styles.input} value={timezone} />
      <View style={styles.row}>
        <Button title="Cancel" onPress={onCancel} />
        <Button title="Create" onPress={() => void createBusiness({ businessType, name, timezone })} />
      </View>
    </ScrollView>
  );
}

function BusinessDashboardScreen({
  appointments,
  business,
  onBack,
  onRefresh,
  onShowAppointments,
  onShowServices,
  onShowStaff,
  services,
  staffMembers
}: {
  appointments: Appointment[];
  business: Business;
  onBack: () => void;
  onRefresh: () => void;
  onShowAppointments: () => void;
  onShowServices: () => void;
  onShowStaff: () => void;
  services: BusinessService[];
  staffMembers: StaffMember[];
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{business.name}</Text>
      <Text>Category: {business.businessType}</Text>
      <Text>Status: {business.status}</Text>
      <View style={styles.row}>
        <Button title="Back" onPress={onBack} />
        <Button title="Refresh" onPress={onRefresh} />
      </View>
      <View style={styles.row}>
        <Button title="Manage Services" onPress={onShowServices} />
        <Button title="Manage Staff" onPress={onShowStaff} />
      </View>
      <Button title="View Appointments" onPress={onShowAppointments} />
      <Summary title="Services" value={services.map((service) => service.name).join(", ") || "None"} />
      <Summary title="Staff" value={staffMembers.map((staff) => staff.displayName).join(", ") || "None"} />
      <Summary title="Appointments" value={appointments.map((appointment) => `${appointment.serviceName} - ${appointment.status}`).join(", ") || "None"} />
    </ScrollView>
  );
}

function ServicesScreen({
  businessId,
  refresh,
  request,
  run,
  services,
  showDashboard
}: {
  businessId: string;
  refresh: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  services: BusinessService[];
  showDashboard: () => void;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [price, setPrice] = useState("0");

  function useService(service: BusinessService) {
    setSelectedServiceId(service.id);
    setName(service.name);
    setDescription(service.description);
    setDurationMinutes(String(service.durationMinutes));
    setPrice(String(service.price));
  }

  async function saveService(method: "POST" | "PATCH") {
    const path = method === "POST" ? `/businesses/${businessId}/services` : `/businesses/${businessId}/services/${selectedServiceId}`;
    await run(async () => {
      await request<BusinessService>(path, {
        body: JSON.stringify({
          description,
          durationMinutes: Number(durationMinutes),
          name,
          price: Number(price)
        }),
        method
      });
      await refresh();
      setSelectedServiceId("");
    }, method === "POST" ? "Service created" : "Service updated");
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Services</Text>
      <Button title="Back to Dashboard" onPress={showDashboard} />
      <TextInput onChangeText={setName} placeholder="Service name" style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" style={styles.input} value={description} />
      <TextInput keyboardType="number-pad" onChangeText={setDurationMinutes} placeholder="Duration minutes" style={styles.input} value={durationMinutes} />
      <TextInput keyboardType="decimal-pad" onChangeText={setPrice} placeholder="Price" style={styles.input} value={price} />
      <View style={styles.row}>
        <Button title="Create" onPress={() => void saveService("POST")} />
        <Button title="Update Selected" onPress={() => void saveService("PATCH")} />
      </View>
      {services.map((service) => (
        <View key={service.id} style={styles.card}>
          <Text style={styles.cardTitle}>{service.name}</Text>
          <Text>{service.description}</Text>
          <Text>{service.durationMinutes} min - {service.price}</Text>
          <Text>{service.active ? "Active" : "Inactive"}</Text>
          <View style={styles.row}>
            <Button title="Edit" onPress={() => useService(service)} />
            <Button title="Deactivate" onPress={() => void run(async () => {
              await request<BusinessService>(`/businesses/${businessId}/services/${service.id}/deactivate`, { method: "POST" });
              await refresh();
            }, "Service deactivated")} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function StaffScreen({
  businessId,
  refresh,
  request,
  run,
  showDashboard,
  staffMembers
}: {
  businessId: string;
  refresh: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  showDashboard: () => void;
  staffMembers: StaffMember[];
}) {
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState("");
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");

  function useStaffMember(staffMember: StaffMember) {
    setSelectedStaffMemberId(staffMember.id);
    setUserId(staffMember.userId);
    setDisplayName(staffMember.displayName);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Staff</Text>
      <Button title="Back to Dashboard" onPress={showDashboard} />
      <TextInput onChangeText={setUserId} placeholder="Existing user ID" style={styles.input} value={userId} />
      <TextInput onChangeText={setDisplayName} placeholder="Display name" style={styles.input} value={displayName} />
      <View style={styles.row}>
        <Button title="Create" onPress={() => void run(async () => {
          await request<StaffMember>(`/businesses/${businessId}/staff`, {
            body: JSON.stringify({ displayName, userId }),
            method: "POST"
          });
          await refresh();
        }, "Staff member created")} />
        <Button title="Update Selected" onPress={() => void run(async () => {
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
          <Text>User: {staffMember.userId}</Text>
          <Text>{staffMember.active ? "Active" : "Inactive"}</Text>
          <View style={styles.row}>
            <Button title="Edit" onPress={() => useStaffMember(staffMember)} />
            <Button title="Deactivate" onPress={() => void run(async () => {
              await request<StaffMember>(`/businesses/${businessId}/staff/${staffMember.id}/deactivate`, { method: "POST" });
              await refresh();
            }, "Staff member deactivated")} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function AppointmentsScreen({
  appointments,
  businessId,
  refresh,
  request,
  run,
  services,
  showDashboard,
  staffMembers
}: {
  appointments: Appointment[];
  businessId: string;
  refresh: () => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  run: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
  services: BusinessService[];
  showDashboard: () => void;
  staffMembers: StaffMember[];
}) {
  const [clientUserId, setClientUserId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffMemberId, setStaffMemberId] = useState("");
  const [startsAt, setStartsAt] = useState("2026-07-01T10:00:00.000Z");
  const [endsAt, setEndsAt] = useState("2026-07-01T10:30:00.000Z");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Appointments</Text>
      <Button title="Back to Dashboard" onPress={showDashboard} />
      <TextInput onChangeText={setClientUserId} placeholder="Client user ID" style={styles.input} value={clientUserId} />
      <TextInput onChangeText={setServiceId} placeholder="Service ID" style={styles.input} value={serviceId} />
      <TextInput onChangeText={setStaffMemberId} placeholder="Staff member ID" style={styles.input} value={staffMemberId} />
      <TextInput onChangeText={setStartsAt} placeholder="Start ISO time" style={styles.input} value={startsAt} />
      <TextInput onChangeText={setEndsAt} placeholder="End ISO time" style={styles.input} value={endsAt} />
      <Button title="Create Appointment" onPress={() => void run(async () => {
        await request<Appointment>(`/businesses/${businessId}/appointments`, {
          body: JSON.stringify({ clientUserId, endsAt, serviceId, staffMemberId, startsAt }),
          method: "POST"
        });
        await refresh();
      }, "Appointment created")} />
      <Summary title="Available service IDs" value={services.map((service) => `${service.name}: ${service.id}`).join("\n") || "Create a service first"} />
      <Summary title="Available staff IDs" value={staffMembers.map((staff) => `${staff.displayName}: ${staff.id}`).join("\n") || "Create staff first"} />
      {appointments.map((appointment) => (
        <View key={appointment.id} style={styles.card}>
          <Text style={styles.cardTitle}>{appointment.serviceName}</Text>
          <Text>Staff: {appointment.staffDisplayName}</Text>
          <Text>Client: {appointment.clientUserId}</Text>
          <Text>{appointment.startsAt} to {appointment.endsAt}</Text>
          <Text>Status: {appointment.status}</Text>
          <View style={styles.row}>
            <Button title="Cancel" onPress={() => void run(async () => {
              await request<Appointment>(`/businesses/${businessId}/appointments/${appointment.id}/cancel`, { method: "POST" });
              await refresh();
            }, "Appointment cancelled")} />
            <Button title="Complete" onPress={() => void run(async () => {
              await request<Appointment>(`/businesses/${businessId}/appointments/${appointment.id}/complete`, { method: "POST" });
              await refresh();
            }, "Appointment completed")} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: "#f8fafc",
    flex: 1,
    padding: 24
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  content: {
    paddingBottom: 48
  },
  empty: {
    color: "#64748b",
    marginTop: 16
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#94a3b8",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  loading: {
    color: "#1d4ed8",
    marginBottom: 8
  },
  message: {
    color: "#b45309",
    marginBottom: 8
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8
  },
  summary: {
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    marginTop: 12,
    padding: 12
  },
  summaryTitle: {
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700"
  }
});
