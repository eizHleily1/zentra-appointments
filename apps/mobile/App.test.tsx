import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import App, {
  AppointmentListCard,
  BookAppointmentScreen,
  BusinessCard,
  BusinessProfileScreen,
  buildBookAppointmentPayload,
  buildBookingVerificationRequestPayload,
  buildConsumerBookAppointmentPayload,
  CategoryBusinessListScreen,
  formatAppointmentStatus,
  formatAppointmentTimeRange,
  formatServicePriceLabel
} from "./App";
import { ExploreTabScreen } from "./screens/consumer/ExploreTabScreen";
import { ConsumerAppointmentCard } from "./components/ConsumerAppointmentCard";
import { BookingConfirmationScreen } from "./screens/consumer/BookingConfirmationScreen";
import { formatBusinessStatus, formatBusinessType, formatServicePriceDisplay } from "./lib/formatters";
import { ScheduleTabScreen } from "./screens/consumer/ScheduleTabScreen";
import { ConsumerAppointmentDetailScreen } from "./screens/consumer/ConsumerAppointmentDetailScreen";
import { OwnerAppointmentDetailScreen } from "./screens/owner/OwnerAppointmentDetailScreen";
import { ClientDetailsScreen } from "./screens/owner/ClientDetailsScreen";
import { ClientsScreen } from "./screens/owner/ClientsScreen";
import { ClientListCard } from "./components/ClientListCard";
import { OwnerTabBar } from "./components/OwnerTabBar";
import { ProfileTabScreen } from "./screens/consumer/ProfileTabScreen";
import { BusinessesScreen } from "./screens/owner/BusinessesScreen";

const noopAsync = async () => {};

describe("App", () => {
  it("opens to Explore without requiring sign in", () => {
    render(<App />);

    expect(screen.getByText("Zentra")).toBeTruthy();
    expect(screen.getAllByText("Explore").length).toBeGreaterThan(0);
    expect(screen.getByText("Barber")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search by business name")).toBeTruthy();
  });

  it("does not render UUIDs or raw ISO timestamps on launch", () => {
    render(<App />);

    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const isoTimestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

    expect(screen.queryByText(uuidPattern)).toBeNull();
    expect(screen.queryByText(isoTimestampPattern)).toBeNull();
  });
});

const DISCOVERY_BUSINESS = {
  address: "123 Main St",
  businessType: "BARBER",
  city: "Amman",
  id: "biz-1",
  name: "Downtown Barber",
  timezone: "Asia/Amman"
};

const DISCOVERY_PROFILE = {
  ...DISCOVERY_BUSINESS,
  businessHours: [
    { closeTime: "18:00", dayOfWeek: 0, id: "h0", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 1, id: "h1", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 2, id: "h2", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 3, id: "h3", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 4, id: "h4", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 5, id: "h5", isClosed: false, openTime: "09:00" },
    { closeTime: "18:00", dayOfWeek: 6, id: "h6", isClosed: false, openTime: "09:00" }
  ],
  isBookable: true,
  services: [{ description: "", durationMinutes: 30, id: "svc-1", name: "Haircut", price: 15 }],
  staff: [{ displayName: "Alex", id: "staff-1" }]
};

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data)
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function mockConsumerApi(input: RequestInfo | URL, init?: RequestInit) {
  const url = requestUrl(input);
  const method = (
    init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  let pathname = url;

  try {
    pathname = new URL(url, "http://localhost:3001").pathname;
  } catch {
    pathname = url;
  }

  if (method === "POST" && pathname.endsWith("/auth/register")) {
    return jsonResponse({ accessToken: "access-token", refreshToken: "refresh-token", tokenType: "Bearer" });
  }

  if (method === "POST" && pathname.endsWith("/auth/logout")) {
    return jsonResponse({ success: true });
  }

  if (method === "GET" && pathname.includes("/available-slots")) {
    return jsonResponse([{ endTime: "2030-07-02T07:30:00.000Z", label: "10:00", startTime: "2030-07-02T07:00:00.000Z" }]);
  }

  if (method === "POST" && pathname.endsWith("/booking-verifications")) {
    return jsonResponse({
      attemptsRemaining: 5,
      expiresAt: "2030-07-02T07:05:00.000Z",
      verificationId: "verification-1"
    });
  }

  if (method === "POST" && pathname.endsWith("/verify")) {
    return jsonResponse({ verified: true });
  }

  if (method === "POST" && pathname.includes("/discovery/businesses/") && pathname.endsWith("/appointments")) {
    return jsonResponse({ startsAt: "2030-07-02T07:00:00.000Z" });
  }

  if (method === "GET" && pathname.endsWith("/discovery/businesses/biz-1")) {
    return jsonResponse(DISCOVERY_PROFILE);
  }

  if (method === "GET" && pathname.endsWith("/discovery/businesses")) {
    return jsonResponse([DISCOVERY_BUSINESS]);
  }

  if (method === "GET" && pathname === "/businesses") {
    return jsonResponse([]);
  }

  if (method === "GET" && pathname.endsWith("/me/appointments")) {
    return jsonResponse([]);
  }

  return jsonResponse({ message: `unmocked ${method} ${pathname}` }, 500);
}

async function openDowntownBarberProfile() {
  await waitFor(() => {
    expect(screen.getByText("Downtown Barber")).toBeTruthy();
  });

  fireEvent.press(screen.getByText("Downtown Barber"));

  await waitFor(() => {
    expect(screen.getByText("Book appointment")).toBeTruthy();
  });
}

async function openBookingScreen() {
  fireEvent.press(screen.getByText("Book appointment"));

  await waitFor(() => {
    expect(screen.getByText("Book at Downtown Barber")).toBeTruthy();
  });
}

async function enterGuestDetails(name = "Maria Lopez", phone = "555-123-4567") {
  await openBookingScreen();

  fireEvent.press(screen.getByText("Haircut"));

  await waitFor(() => {
    expect(screen.getByText("10:00")).toBeTruthy();
  });

  fireEvent.press(screen.getByText("10:00"));
  fireEvent.changeText(screen.getByPlaceholderText("Your name"), name);
  fireEvent.changeText(screen.getByPlaceholderText("Phone number"), phone);
}

async function verifyGuestPhone(code = "123456") {
  fireEvent.press(screen.getByText("Send code"));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("6-digit code")).toBeTruthy();
  });

  fireEvent.changeText(screen.getByPlaceholderText("6-digit code"), code);
  fireEvent.press(screen.getByText("Verify code"));

  await waitFor(() => {
    expect(screen.getByText("Phone verified")).toBeTruthy();
  });
}

async function completeGuestBooking(name = "Maria Lopez", phone = "555-123-4567") {
  await enterGuestDetails(name, phone);
  await verifyGuestPhone();
  fireEvent.press(screen.getByText("Confirm booking"));
}

function pressConsumerTab(label: "Home" | "Explore" | "Schedule" | "Profile") {
  const matches = screen.getAllByText(label);
  fireEvent.press(matches[matches.length - 1]);
}

async function signInFromProfile() {
  pressConsumerTab("Profile");
  fireEvent.press(screen.getByText("Sign in"));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("Email")).toBeTruthy();
  });

  fireEvent.changeText(screen.getByPlaceholderText("Email"), "client@example.com");
  fireEvent.changeText(screen.getByPlaceholderText("Password"), "strong-password");
  const createAccountButtons = screen.getAllByText("Create account");
  fireEvent.press(createAccountButtons[createAccountButtons.length - 1]);

  await waitFor(() => {
    expect(screen.getByText("client@example.com")).toBeTruthy();
  });
}

function fetchPathname(input: RequestInfo | URL): string {
  const url = requestUrl(input);

  try {
    return new URL(url, "http://localhost:3001").pathname;
  } catch {
    return url;
  }
}

function findFetchCall(pathname: string, method = "POST") {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  return fetchMock.mock.calls.find(([input, init]) => {
    const callMethod = (init?.method ?? "GET").toUpperCase();
    return callMethod === method && fetchPathname(input).endsWith(pathname);
  });
}

describe("App consumer Home tab from Explore stack", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn(mockConsumerApi) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders Home after Explore → profile → Home", async () => {
    render(<App />);
    await openDowntownBarberProfile();

    pressConsumerTab("Home");

    expect(screen.getByText("Browse local businesses and book appointments in one place.")).toBeTruthy();
    expect(screen.queryByText("Book appointment")).toBeNull();
  });

  it("keeps the business profile when tapping Explore again", async () => {
    render(<App />);
    await openDowntownBarberProfile();

    pressConsumerTab("Explore");

    expect(screen.getByText("Book appointment")).toBeTruthy();
    expect(screen.queryByText("Search by business name")).toBeNull();
  });

  it("returns to the Explore list after leaving a profile via Home", async () => {
    render(<App />);
    await openDowntownBarberProfile();

    pressConsumerTab("Home");
    pressConsumerTab("Explore");

    expect(screen.getByPlaceholderText("Search by business name")).toBeTruthy();
    expect(screen.getByText("Downtown Barber")).toBeTruthy();
    expect(screen.queryByText("Book appointment")).toBeNull();
  });

  it("does not open auth when starting a booking", async () => {
    render(<App />);
    await openDowntownBarberProfile();
    fireEvent.press(screen.getByText("Book appointment"));

    await waitFor(() => {
      expect(screen.getByText("Book at Downtown Barber")).toBeTruthy();
    });
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(screen.queryByPlaceholderText("Email")).toBeNull();
  });

  it("renders Home after Explore → booking flow → Home", async () => {
    render(<App />);
    await openDowntownBarberProfile();
    await openBookingScreen();

    pressConsumerTab("Home");

    await waitFor(() => {
      expect(screen.getByText("Browse local businesses and book appointments in one place.")).toBeTruthy();
    });
    expect(screen.queryByText("Book at Downtown Barber")).toBeNull();
  });

  it("lets a guest book from business profile through confirmation", async () => {
    render(<App />);
    await openDowntownBarberProfile();
    await completeGuestBooking();

    await waitFor(() => {
      expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    });

    const verificationCall = findFetchCall("/discovery/businesses/biz-1/booking-verifications");
    expect(JSON.parse(String(verificationCall?.[1]?.body))).toEqual({ phoneNumber: "555-123-4567" });

    // The challenge id travels in the body so it never reaches access logs via the URL.
    const verifyCall = findFetchCall("/discovery/businesses/biz-1/booking-verifications/verify");
    expect(JSON.parse(String(verifyCall?.[1]?.body))).toEqual({
      code: "123456",
      verificationId: "verification-1"
    });

    const appointmentCall = findFetchCall("/discovery/businesses/biz-1/appointments");
    expect(appointmentCall).toBeDefined();
    expect(JSON.parse(String(appointmentCall?.[1]?.body))).toEqual({
      displayName: "Maria Lopez",
      phoneNumber: "555-123-4567",
      serviceId: "svc-1",
      staffMemberId: "staff-1",
      startTime: "2030-07-02T07:00:00.000Z",
      verificationId: "verification-1"
    });

    expect(screen.getByText("Back to Explore")).toBeTruthy();
    expect(screen.queryByText("View Schedule")).toBeNull();

    fireEvent.press(screen.getByText("Back to Explore"));

    await waitFor(() => {
      expect(screen.getByText("Downtown Barber")).toBeTruthy();
    });
    expect(screen.queryByText("Sign in to see your schedule")).toBeNull();
    expect(screen.queryByText("Appointment confirmed")).toBeNull();
  });

  it("requires phone verification before the confirm button appears", async () => {
    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails();

    expect(screen.getByText("Verify your phone number to confirm this booking.")).toBeTruthy();
    expect(screen.queryByText("Confirm booking")).toBeNull();
    expect(findFetchCall("/discovery/businesses/biz-1/appointments")).toBeUndefined();
  });

  it("shows the server message when a code is rejected and keeps the guest on the code step", async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/verify")) {
        return Promise.resolve(jsonResponse({ message: "Verification code is invalid or expired" }, 400));
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails();
    fireEvent.press(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("6-digit code")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("6-digit code"), "000000");
    fireEvent.press(screen.getByText("Verify code"));

    await waitFor(() => {
      expect(screen.getByText("Verification code is invalid or expired")).toBeTruthy();
    });
    expect(screen.getByText("Verify code")).toBeTruthy();
    expect(screen.queryByText("Confirm booking")).toBeNull();
  });

  it("keeps the phone verified when the slot became unavailable", async () => {
    let bookingAttempts = 0;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const pathname = fetchPathname(input);

      if (method === "POST" && pathname.includes("/discovery/businesses/") && pathname.endsWith("/appointments")) {
        bookingAttempts += 1;

        if (bookingAttempts === 1) {
          return Promise.resolve(
            jsonResponse({ message: "This appointment slot is no longer available" }, 409)
          );
        }
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await completeGuestBooking();

    await waitFor(() => {
      expect(screen.getByText("This appointment slot is no longer available")).toBeTruthy();
    });
    expect(screen.getByText("Phone verified")).toBeTruthy();

    fireEvent.press(screen.getByText("Confirm booking"));

    await waitFor(() => {
      expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    });
  });

  it("keeps the existing challenge and the code input when a resend is throttled", async () => {
    let verificationRequests = 0;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/booking-verifications")) {
        verificationRequests += 1;

        if (verificationRequests > 1) {
          return Promise.resolve(
            jsonResponse({ message: "Wait before requesting another verification code" }, 429)
          );
        }
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails();
    fireEvent.press(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("6-digit code")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Resend code"));

    await waitFor(() => {
      expect(screen.getByText("Wait before requesting another verification code")).toBeTruthy();
    });

    // The first code is still valid, so the guest can finish with it.
    expect(screen.getByPlaceholderText("6-digit code")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("6-digit code"), "123456");
    fireEvent.press(screen.getByText("Verify code"));

    await waitFor(() => {
      expect(screen.getByText("Phone verified")).toBeTruthy();
    });
  });

  it("lets the guest request a new code when booking rejects an unusable verification", async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/appointments")) {
        return Promise.resolve(
          jsonResponse(
            { code: "booking_verification_invalid", message: "Verify your phone number before booking" },
            400
          )
        );
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await completeGuestBooking();

    await waitFor(() => {
      expect(screen.getByText("Verify your phone number before booking")).toBeTruthy();
    });

    // The stale verified state is dropped so the guest is not stuck on a dead Confirm.
    expect(screen.queryByText("Phone verified")).toBeNull();
    expect(screen.queryByText("Confirm booking")).toBeNull();
    expect(screen.getByText("Send code")).toBeTruthy();

    await verifyGuestPhone();
    expect(screen.getByText("Confirm booking")).toBeTruthy();
  });

  it("keeps the verified challenge when booking fails for a reason unrelated to verification", async () => {
    let bookingAttempts = 0;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/appointments")) {
        bookingAttempts += 1;

        if (bookingAttempts === 1) {
          // A plain 400 with no verification marker: the slot drifted into the past.
          return Promise.resolve(
            jsonResponse({ message: "Appointment start time must be in the future" }, 400)
          );
        }
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await completeGuestBooking();

    await waitFor(() => {
      expect(screen.getByText("Appointment start time must be in the future")).toBeTruthy();
    });

    // Nothing about the challenge changed, so the guest keeps it and can just retry.
    expect(screen.getByText("Phone verified")).toBeTruthy();
    expect(screen.queryByText("Send code")).toBeNull();

    fireEvent.press(screen.getByText("Confirm booking"));

    await waitFor(() => {
      expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    });
  });

  it("does not reset OTP state when booking validation lacks the verification error code", async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/appointments")) {
        return Promise.resolve(
          jsonResponse({ message: "A verified phone number is required to book" }, 400)
        );
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await completeGuestBooking();

    await waitFor(() => {
      expect(screen.getByText("A verified phone number is required to book")).toBeTruthy();
    });

    expect(screen.getByText("Phone verified")).toBeTruthy();
    expect(screen.getByText("Confirm booking")).toBeTruthy();
  });

  it("ignores a code response that arrives after the guest changed the phone number", async () => {
    let releaseVerificationRequest: (() => void) | null = null;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/booking-verifications")) {
        return new Promise((resolve) => {
          releaseVerificationRequest = () => resolve(jsonResponse({ verificationId: "verification-stale" }));
        });
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails();
    fireEvent.press(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByText("Sending code...")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("Phone number"), "555-000-1111");

    await act(async () => {
      releaseVerificationRequest?.();
    });

    // The in-flight challenge belonged to the old number and must not come back.
    expect(screen.getByText("Send code")).toBeTruthy();
    expect(screen.queryByPlaceholderText("6-digit code")).toBeNull();
  });

  it("ignores a verify response that arrives after the guest changed the phone number", async () => {
    let releaseVerify: (() => void) | null = null;
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/verify")) {
        return new Promise((resolve) => {
          releaseVerify = () => resolve(jsonResponse({ verified: true }));
        });
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails();
    fireEvent.press(screen.getByText("Send code"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("6-digit code")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("6-digit code"), "123456");
    fireEvent.press(screen.getByText("Verify code"));

    await waitFor(() => {
      expect(screen.getByText("Checking code...")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("Phone number"), "555-000-1111");

    await act(async () => {
      releaseVerify?.();
    });

    // Verifying the old number must not mark the new number as verified.
    expect(screen.queryByText("Phone verified")).toBeNull();
    expect(screen.getByText("Send code")).toBeTruthy();
  });

  it("ignores a stale booking failure after the guest verified a new number and confirmed again", async () => {
    const appointmentResolvers: Array<(value: ReturnType<typeof jsonResponse>) => void> = [];
    globalThis.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && fetchPathname(input).endsWith("/appointments")) {
        return new Promise((resolve) => {
          appointmentResolvers.push(resolve);
        });
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails("Maria Lopez", "555-123-4567");
    await verifyGuestPhone();
    fireEvent.press(screen.getByText("Confirm booking"));

    await waitFor(() => {
      expect(screen.getByText("Confirming...")).toBeTruthy();
    });
    expect(appointmentResolvers).toHaveLength(1);

    fireEvent.changeText(screen.getByPlaceholderText("Phone number"), "555-000-1111");
    await verifyGuestPhone();

    // Phone change must clear booking=true so Confirm is usable for the new number.
    expect(screen.getByText("Confirm booking")).toBeTruthy();
    expect(screen.queryByText("Confirming...")).toBeNull();
    expect(screen.getByText("Phone verified")).toBeTruthy();

    fireEvent.press(screen.getByText("Confirm booking"));

    await waitFor(() => {
      expect(screen.getByText("Confirming...")).toBeTruthy();
    });
    expect(appointmentResolvers).toHaveLength(2);

    await act(async () => {
      appointmentResolvers[0](
        jsonResponse(
          {
            code: "booking_verification_invalid",
            message: "Verify your phone number before booking"
          },
          400
        )
      );
    });

    // The abandoned phone-A failure must not clear the phone-B spinner or verified state.
    expect(screen.getByText("Confirming...")).toBeTruthy();
    expect(screen.queryByText("Verify your phone number before booking")).toBeNull();
    expect(screen.getByText("Phone verified")).toBeTruthy();
    expect(screen.getByDisplayValue("555-000-1111")).toBeTruthy();
  });

  it("clears the verification when the phone number is edited", async () => {
    render(<App />);
    await openDowntownBarberProfile();
    await enterGuestDetails();
    await verifyGuestPhone();

    fireEvent.changeText(screen.getByPlaceholderText("Phone number"), "555-000-1111");

    expect(screen.queryByText("Phone verified")).toBeNull();
    expect(screen.getByText("Send code")).toBeTruthy();
  });

  it("lets a signed-in consumer book without using JWT identity", async () => {
    render(<App />);
    await signInFromProfile();
    pressConsumerTab("Explore");
    await openDowntownBarberProfile();
    await completeGuestBooking("Alex Lopez", "555-000-1111");

    await waitFor(() => {
      expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    });

    const appointmentCall = findFetchCall("/discovery/businesses/biz-1/appointments");
    expect(JSON.parse(String(appointmentCall?.[1]?.body))).toEqual({
      displayName: "Alex Lopez",
      phoneNumber: "555-000-1111",
      serviceId: "svc-1",
      staffMemberId: "staff-1",
      startTime: "2030-07-02T07:00:00.000Z",
      verificationId: "verification-1"
    });
  });

  it("renders Home after Explore → confirmation → Home", async () => {
    render(<App />);
    await openDowntownBarberProfile();
    await completeGuestBooking();

    await waitFor(() => {
      expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    });

    pressConsumerTab("Home");

    await waitFor(() => {
      expect(screen.getByText("Browse local businesses and book appointments in one place.")).toBeTruthy();
    });
    expect(screen.queryByText("Appointment confirmed")).toBeNull();
  });
});

describe("ExploreTabScreen", () => {
  it("renders discovery categories and search", () => {
    render(
      <ExploreTabScreen
        businesses={[]}
        loading={false}
        onSearchQueryChange={() => undefined}
        onSelectBusiness={() => undefined}
        onSelectCategory={() => undefined}
        searchQuery=""
        selectedCategory={null}
      />
    );

    expect(screen.getByText("Barber")).toBeTruthy();
    expect(screen.getByText("Beauty")).toBeTruthy();
    expect(screen.getByText("Dentist")).toBeTruthy();
    expect(screen.getByText("Fitness")).toBeTruthy();
    expect(screen.getByText("Clinic")).toBeTruthy();
    expect(screen.getByText("Coaching")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search by business name")).toBeTruthy();
  });

  it("renders business cards with human labels and no UUIDs", () => {
    render(
      <ExploreTabScreen
        businesses={[
          {
            address: "123 Main St",
            businessType: "BARBER",
            city: "Amman",
            id: "00000000-0000-4000-8000-000000000010",
            name: "Downtown Barber",
            timezone: "Asia/Amman"
          }
        ]}
        loading={false}
        onSearchQueryChange={() => undefined}
        onSelectBusiness={() => undefined}
        onSelectCategory={() => undefined}
        searchQuery=""
        selectedCategory={null}
      />
    );

    expect(screen.getByText("Downtown Barber")).toBeTruthy();
    expect(screen.getByText("Barber Shop")).toBeTruthy();
    expect(screen.getByText("Amman · 123 Main St")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
    expect(screen.getByText("View profile")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000010/)).toBeNull();
    expect(screen.queryByText("BARBER")).toBeNull();
  });
});

describe("BusinessCard", () => {
  it("renders a tappable business card without raw enums", () => {
    const onPress = jest.fn();

    render(
      <BusinessCard
        business={{
          address: null,
          businessType: "BARBER",
          city: "Amman",
          id: "00000000-0000-4000-8000-000000000010",
          name: "Downtown Barber",
          timezone: "Asia/Amman"
        }}
        onPress={onPress}
      />
    );

    fireEvent.press(screen.getByText("View profile"));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText("Barber Shop")).toBeTruthy();
    expect(screen.queryByText("BARBER")).toBeNull();
  });
});

describe("CategoryBusinessListScreen", () => {
  it("renders business cards without UUIDs", () => {
    render(
      <CategoryBusinessListScreen
        businesses={[
          {
            address: "123 Main St",
            businessType: "BARBER",
            city: "Amman",
            id: "00000000-0000-4000-8000-000000000010",
            name: "Downtown Barber",
            timezone: "Asia/Amman"
          }
        ]}
        categoryLabel="Barber"
        onBack={() => undefined}
        onSelectBusiness={() => undefined}
      />
    );

    expect(screen.getByText("Downtown Barber")).toBeTruthy();
    expect(screen.getByText("Barber Shop")).toBeTruthy();
    expect(screen.getByText("Amman · 123 Main St")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000010/)).toBeNull();
  });
});

const profileFixture = {
  address: "123 Main St",
  businessHours: [
    {
      closeTime: "18:00",
      dayOfWeek: 1,
      id: "hour-1",
      isClosed: false,
      openTime: "09:00"
    }
  ],
  businessType: "BARBER",
  city: "Amman",
  id: "00000000-0000-4000-8000-000000000010",
  isBookable: true,
  name: "Downtown Barber",
  services: [
    {
      description: "Classic cut",
      durationMinutes: 30,
      id: "00000000-0000-4000-8000-000000000011",
      name: "Haircut",
      price: 15
    }
  ],
  staff: [{ displayName: "Alex", id: "00000000-0000-4000-8000-000000000012" }],
  timezone: "Asia/Amman"
};

describe("BusinessProfileScreen", () => {
  it("renders services, staff, hours, and book CTA", () => {
    render(
      <BusinessProfileScreen
        business={profileFixture}
        onBack={() => undefined}
        onBook={() => undefined}
      />
    );

    expect(screen.getByText("Downtown Barber")).toBeTruthy();
    expect(screen.getByText("Barber Shop")).toBeTruthy();
    expect(screen.getByText("Amman · 123 Main St")).toBeTruthy();
    expect(screen.getByText("Hours")).toBeTruthy();
    expect(screen.getByText("Haircut")).toBeTruthy();
    expect(screen.getByText("30 min · ₪15")).toBeTruthy();
    expect(screen.getByText("Alex")).toBeTruthy();
    expect(screen.getByText("Book appointment")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000011/)).toBeNull();
    expect(screen.queryByText("BARBER")).toBeNull();
  });

  it("hides book CTA and explains when business is not bookable", () => {
    render(
      <BusinessProfileScreen
        business={{
          ...profileFixture,
          isBookable: false,
          services: [],
          staff: []
        }}
        onBack={() => undefined}
        onBook={() => undefined}
      />
    );

    expect(screen.getByText("Booking not available yet")).toBeTruthy();
    expect(screen.getByText(/services or staff/i)).toBeTruthy();
    expect(screen.queryByText("Book appointment")).toBeNull();
  });
});

describe("BookAppointmentScreen", () => {
  it("renders the client search and create flow before service selection", () => {
    render(
      <BookAppointmentScreen
        businessId="business-1"
        onBack={() => undefined}
        refresh={noopAsync}
        request={noopAsync as never}
        run={noopAsync as never}
        services={[]}
        staffMembers={[]}
      />
    );

    expect(screen.getByText("Client")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search by name or phone")).toBeTruthy();
    expect(screen.getByText("Search clients")).toBeTruthy();
    expect(screen.getByText("Or create new client")).toBeTruthy();
    expect(screen.getByPlaceholderText("Client name")).toBeTruthy();
    expect(screen.getByText("Create and select client")).toBeTruthy();
    expect(screen.queryByText("Service")).toBeNull();
  });
});

describe("buildConsumerBookAppointmentPayload", () => {
  it("includes guest details and does not include clientId", () => {
    const payload = buildConsumerBookAppointmentPayload({
      displayName: " Maria Lopez ",
      phoneNumber: " 555-123-4567 ",
      serviceId: "00000000-0000-4000-8000-000000000002",
      staffMemberId: "00000000-0000-4000-8000-000000000003",
      startTime: "2030-07-02T07:00:00.000Z",
      verificationId: "00000000-0000-4000-8000-000000000004"
    });

    expect(payload).toEqual({
      displayName: "Maria Lopez",
      phoneNumber: "555-123-4567",
      serviceId: "00000000-0000-4000-8000-000000000002",
      staffMemberId: "00000000-0000-4000-8000-000000000003",
      startTime: "2030-07-02T07:00:00.000Z",
      verificationId: "00000000-0000-4000-8000-000000000004"
    });
    expect(payload).not.toHaveProperty("clientId");
  });
});

describe("buildBookingVerificationRequestPayload", () => {
  it("trims the phone number and sends nothing else", () => {
    expect(buildBookingVerificationRequestPayload({ phoneNumber: " 555-123-4567 " })).toEqual({
      phoneNumber: "555-123-4567"
    });
  });
});

describe("ConsumerAppointmentCard", () => {
  it("does not render UUIDs or ISO timestamps", () => {
    render(
      <ConsumerAppointmentCard
        appointment={{
          businessAddress: "123 Main St",
          businessCity: "Amman",
          businessId: "00000000-0000-4000-8000-000000000010",
          businessName: "Downtown Barber",
          businessTimezone: "Asia/Amman",
          clientDisplayName: "Maria",
          endsAt: "2030-07-02T07:30:00.000Z",
          id: "00000000-0000-4000-8000-000000000099",
          serviceName: "Haircut",
          servicePrice: 15,
          staffDisplayName: "Alex",
          startsAt: "2030-07-02T07:00:00.000Z",
          status: "BOOKED"
        }}
      />
    );

    expect(screen.getByText("Downtown Barber")).toBeTruthy();
    expect(screen.getByText("Haircut · Alex")).toBeTruthy();
    expect(screen.getByText("Booked")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000099/)).toBeNull();
    expect(screen.queryByText(/2030-07-02T07:00:00/)).toBeNull();
  });
});

describe("ScheduleTabScreen", () => {
  it("groups schedule cards by day without UUIDs or ISO timestamps", async () => {
    const request = jest.fn().mockResolvedValue([
      {
        businessAddress: null,
        businessCity: "Amman",
        businessId: "00000000-0000-4000-8000-000000000010",
        businessName: "Prime Barber",
        businessTimezone: "Asia/Amman",
        clientDisplayName: "Maria",
        endsAt: "2030-07-03T08:30:00.000Z",
        id: "00000000-0000-4000-8000-000000000011",
        serviceName: "Haircut",
        servicePrice: 15,
        staffDisplayName: "Sam",
        startsAt: "2030-07-03T08:00:00.000Z",
        status: "BOOKED"
      },
      {
        businessAddress: null,
        businessCity: "Amman",
        businessId: "00000000-0000-4000-8000-000000000010",
        businessName: "Prime Barber",
        businessTimezone: "Asia/Amman",
        clientDisplayName: "Maria",
        endsAt: "2030-07-02T09:30:00.000Z",
        id: "00000000-0000-4000-8000-000000000012",
        serviceName: "Beard trim",
        servicePrice: null,
        staffDisplayName: "Sam",
        startsAt: "2030-07-02T09:00:00.000Z",
        status: "BOOKED"
      }
    ]);

    render(
      <ScheduleTabScreen
        isActive
        isAuthenticated
        onBookAgain={() => undefined}
        onSignIn={() => undefined}
        request={request}
      />
    );

    expect(await screen.findByText("Beard trim · Sam")).toBeTruthy();
    expect(screen.getByText("Haircut · Sam")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000011/)).toBeNull();
    expect(screen.queryByText(/2030-07-02T09:00:00/)).toBeNull();
  });

  it("reloads schedule when returning from detail", async () => {
    const appointment = {
      businessAddress: null,
      businessCity: "Amman",
      businessId: "00000000-0000-4000-8000-000000000010",
      businessName: "Prime Barber",
      businessTimezone: "Asia/Amman",
      clientDisplayName: "Maria",
      endsAt: "2030-07-02T09:30:00.000Z",
      id: "00000000-0000-4000-8000-000000000012",
      serviceName: "Beard trim",
      servicePrice: null,
      staffDisplayName: "Sam",
      startsAt: "2030-07-02T09:00:00.000Z",
      status: "BOOKED" as const
    };
    const request = jest.fn().mockImplementation((path: string) => {
      if (path.startsWith("/me/appointments/")) {
        return Promise.resolve(appointment);
      }

      return Promise.resolve([appointment]);
    });

    render(
      <ScheduleTabScreen
        isActive
        isAuthenticated
        onBookAgain={() => undefined}
        onSignIn={() => undefined}
        request={request}
      />
    );

    expect(await screen.findByText("Beard trim · Sam")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("Beard trim · Sam"));
    expect(await screen.findByText("Back to Schedule")).toBeTruthy();

    fireEvent.press(screen.getByText("Back to Schedule"));
    expect(await screen.findByText("Beard trim · Sam")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[2][0]).toBe("/me/appointments");
  });

  it("shows past appointments in a separate section", async () => {
    const request = jest.fn().mockResolvedValue([
      {
        businessAddress: null,
        businessCity: "Amman",
        businessId: "00000000-0000-4000-8000-000000000010",
        businessName: "Prime Barber",
        businessTimezone: "Asia/Amman",
        clientDisplayName: "Maria",
        endsAt: "2020-01-01T08:30:00.000Z",
        id: "00000000-0000-4000-8000-000000000013",
        serviceName: "Old haircut",
        servicePrice: 15,
        staffDisplayName: "Sam",
        startsAt: "2020-01-01T08:00:00.000Z",
        status: "COMPLETED"
      }
    ]);

    render(
      <ScheduleTabScreen
        isActive
        isAuthenticated
        onBookAgain={() => undefined}
        onSignIn={() => undefined}
        request={request}
      />
    );

    expect(await screen.findByText("Past")).toBeTruthy();
    expect(screen.getByText("Old haircut · Sam")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("No upcoming appointments")).toBeTruthy();
  });
});

describe("ConsumerAppointmentDetailScreen", () => {
  it("renders human-readable appointment details and book again", async () => {
    const onBookAgain = jest.fn();
    const request = jest.fn().mockResolvedValue({
      businessAddress: "123 Main St",
      businessCity: "Amman",
      businessId: "00000000-0000-4000-8000-000000000010",
      businessName: "Prime Barber",
      businessTimezone: "Asia/Amman",
      clientDisplayName: "Maria",
      endsAt: "2030-07-02T07:30:00.000Z",
      id: "00000000-0000-4000-8000-000000000011",
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Sam",
      startsAt: "2030-07-02T07:00:00.000Z",
      status: "BOOKED"
    });

    render(
      <ConsumerAppointmentDetailScreen
        appointmentId="00000000-0000-4000-8000-000000000011"
        onBack={() => undefined}
        onBookAgain={onBookAgain}
        request={request}
      />
    );

    expect(await screen.findByText("Prime Barber")).toBeTruthy();
    expect(screen.getByText("Booked")).toBeTruthy();
    expect(screen.getByText("Amman · 123 Main St")).toBeTruthy();
    fireEvent.press(screen.getByText("Book again"));
    expect(onBookAgain).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000010");
  });
});

describe("OwnerAppointmentDetailScreen", () => {
  const baseAppointment = {
    businessId: "business-1",
    clientDisplayName: "Maria Lopez",
    clientId: "00000000-0000-4000-8000-000000000001",
    clientPhoneNumber: "+1 555-123-4567",
    endsAt: "2030-07-02T07:30:00.000Z",
    id: "00000000-0000-4000-8000-000000000099",
    serviceDurationMinutes: 30,
    serviceId: "00000000-0000-4000-8000-000000000002",
    serviceName: "Haircut",
    servicePrice: 15,
    staffDisplayName: "Alex",
    staffMemberId: "00000000-0000-4000-8000-000000000003",
    startsAt: "2030-07-02T07:00:00.000Z",
    status: "BOOKED" as const
  };

  it("renders client info and booked actions with confirmation", async () => {
    render(
      <OwnerAppointmentDetailScreen
        appointmentId={baseAppointment.id}
        businessId="business-1"
        initialAppointment={baseAppointment}
        onActionComplete={noopAsync}
        onBack={() => undefined}
        onBookForClient={() => undefined}
        request={noopAsync as never}
        run={noopAsync as never}
        timezone="Asia/Amman"
      />
    );

    expect(screen.getByText("Maria Lopez")).toBeTruthy();
    expect(screen.getByText("+1 555-123-4567")).toBeTruthy();
    expect(screen.getByText("Complete appointment")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel appointment"));
    expect(screen.getByText("Cancel this appointment?")).toBeTruthy();
  });

  it("hides booked actions when appointment is completed", () => {
    render(
      <OwnerAppointmentDetailScreen
        appointmentId={baseAppointment.id}
        businessId="business-1"
        initialAppointment={{ ...baseAppointment, status: "COMPLETED" }}
        onActionComplete={noopAsync}
        onBack={() => undefined}
        onBookForClient={() => undefined}
        request={noopAsync as never}
        run={noopAsync as never}
        timezone="Asia/Amman"
      />
    );

    expect(screen.queryByText("Complete appointment")).toBeNull();
    expect(screen.queryByText("Cancel appointment")).toBeNull();
  });
});

describe("AppointmentListCard", () => {
  const baseAppointment = {
    businessId: "business-1",
    clientDisplayName: "Maria Lopez",
    clientId: "00000000-0000-4000-8000-000000000001",
    clientPhoneNumber: "+1 555-123-4567",
    endsAt: "2030-07-02T07:30:00.000Z",
    id: "00000000-0000-4000-8000-000000000099",
    serviceDurationMinutes: 30,
    serviceId: "00000000-0000-4000-8000-000000000002",
    serviceName: "Haircut",
    servicePrice: 15,
    staffDisplayName: "Alex",
    staffMemberId: "00000000-0000-4000-8000-000000000003",
    startsAt: "2030-07-02T07:00:00.000Z",
    status: "BOOKED" as const
  };

  it("renders clientDisplayName and opens detail on press", () => {
    const onPress = jest.fn();

    render(
      <AppointmentListCard
        appointment={baseAppointment}
        onPress={onPress}
        timezone="Asia/Amman"
      />
    );

    expect(screen.getByText("Maria Lopez")).toBeTruthy();
    fireEvent.press(screen.getByText("Maria Lopez"));
    expect(onPress).toHaveBeenCalled();
  });

  it("does not render inline complete or cancel actions", () => {
    render(
      <AppointmentListCard
        appointment={baseAppointment}
        onPress={() => undefined}
        timezone="Asia/Amman"
      />
    );

    expect(screen.queryByText("Complete")).toBeNull();
    expect(screen.queryByText("Cancel")).toBeNull();
  });
});

describe("buildBookAppointmentPayload", () => {
  it("includes clientId for owner booking", () => {
    expect(
      buildBookAppointmentPayload({
        clientId: "00000000-0000-4000-8000-000000000001",
        serviceId: "00000000-0000-4000-8000-000000000002",
        staffMemberId: "00000000-0000-4000-8000-000000000003",
        startTime: "2030-07-02T07:00:00.000Z"
      })
    ).toEqual({
      clientId: "00000000-0000-4000-8000-000000000001",
      serviceId: "00000000-0000-4000-8000-000000000002",
      staffMemberId: "00000000-0000-4000-8000-000000000003",
      startTime: "2030-07-02T07:00:00.000Z"
    });
  });
});

describe("formatters", () => {
  it("formats service price display with currency", () => {
    expect(formatServicePriceDisplay(70)).toBe("₪70");
    expect(formatServicePriceDisplay(null)).toBeNull();
  });

  it("formats appointment status labels", () => {
    expect(formatAppointmentStatus("BOOKED")).toBe("Booked");
    expect(formatAppointmentStatus("CANCELLED")).toBe("Cancelled");
    expect(formatAppointmentStatus("COMPLETED")).toBe("Completed");
  });

  it("formats service price labels", () => {
    expect(formatServicePriceLabel(null)).toBeNull();
    expect(formatServicePriceLabel(0)).toBeNull();
    expect(formatServicePriceLabel(15)).toBe("15");
  });

  it("formats appointment time ranges without ISO timestamps", () => {
    const label = formatAppointmentTimeRange(
      "2030-07-02T07:00:00.000Z",
      "2030-07-02T07:30:00.000Z",
      "Asia/Amman"
    );

    expect(label).not.toMatch(/2030-07-02T/);
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("ClientsScreen", () => {
  it("renders search, add client, and empty state", () => {
    const request = jest.fn().mockResolvedValue([]);

    render(
      <ClientsScreen
        businessId="business-1"
        onBookAppointment={() => undefined}
        request={request}
        run={noopAsync as never}
        timezone="Asia/Amman"
      />
    );

    expect(screen.getByText("Clients")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search by name, phone, or email")).toBeTruthy();
    expect(screen.getByText("Add client")).toBeTruthy();
    expect(screen.getByText("No clients yet")).toBeTruthy();
  });
});

describe("ClientDetailsScreen", () => {
  it("shows book appointment and deactivate confirmation", async () => {
    const request = jest.fn().mockResolvedValue({
      appointments: [],
      client: {
        active: true,
        businessId: "business-1",
        displayName: "Maria Lopez",
        email: "maria@example.com",
        id: "00000000-0000-4000-8000-000000000011",
        linkedUserId: null,
        phoneNumber: "+1 555-123-4567"
      }
    });

    render(
      <ClientDetailsScreen
        businessId="business-1"
        clientId="00000000-0000-4000-8000-000000000011"
        onBack={() => undefined}
        onBookAppointment={() => undefined}
        onClientUpdated={() => undefined}
        request={request}
        run={noopAsync as never}
        timezone="Asia/Amman"
      />
    );

    expect(await screen.findByText("Book appointment")).toBeTruthy();
    fireEvent.press(screen.getByText("Deactivate client"));

    expect(screen.getByText("Deactivate Maria Lopez?")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });
});

describe("OwnerTabBar", () => {
  it("shows four primary owner tabs", () => {
    render(<OwnerTabBar activeTab="home" onChange={() => undefined} />);

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Appointments")).toBeTruthy();
    expect(screen.getByText("Clients")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.queryByText("Services")).toBeNull();
    expect(screen.queryByText("Staff")).toBeNull();
  });
});

describe("ClientListCard", () => {
  it("renders client details without UUIDs", () => {
    render(
      <ClientListCard
        client={{
          active: true,
          businessId: "00000000-0000-4000-8000-000000000010",
          displayName: "Maria Lopez",
          email: "maria@example.com",
          id: "00000000-0000-4000-8000-000000000011",
          lastAppointmentAt: "2030-07-02T07:00:00.000Z",
          linkedUserId: null,
          phoneNumber: "+1 555-123-4567",
          totalAppointments: 2
        }}
        onPress={() => undefined}
        timezone="Asia/Amman"
      />
    );

    expect(screen.getByText("Maria Lopez")).toBeTruthy();
    expect(screen.getByText("+1 555-123-4567")).toBeTruthy();
    expect(screen.getByText("maria@example.com")).toBeTruthy();
    expect(screen.getByText("2 appointments")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000011/)).toBeNull();
    expect(screen.queryByText(/2030-07-02T/)).toBeNull();
  });
});

describe("ProfileTabScreen", () => {
  it("lets a signed-in user with no businesses open manage businesses", () => {
    const onManageBusinesses = jest.fn();

    render(
      <ProfileTabScreen
        email="owner@example.com"
        isAuthenticated
        onManageBusinesses={onManageBusinesses}
        onRecentBusiness={() => undefined}
        onSignIn={() => undefined}
        onSignOut={() => undefined}
        recentBusinesses={[]}
      />
    );

    expect(screen.getByText("Manage your businesses")).toBeTruthy();
    fireEvent.press(screen.getByText("Manage your businesses"));
    expect(onManageBusinesses).toHaveBeenCalledTimes(1);
  });

  it("does not show manage businesses until the user is signed in", () => {
    render(
      <ProfileTabScreen
        email={null}
        isAuthenticated={false}
        onManageBusinesses={() => undefined}
        onRecentBusiness={() => undefined}
        onSignIn={() => undefined}
        onSignOut={() => undefined}
        recentBusinesses={[]}
      />
    );

    expect(screen.queryByText("Manage your businesses")).toBeNull();
    expect(screen.getByText("Sign in")).toBeTruthy();
  });
});

describe("BusinessesScreen", () => {
  it("offers create business when the owner has none", () => {
    const onCreateBusiness = jest.fn();

    render(
      <BusinessesScreen
        businesses={[]}
        formatBusinessStatus={formatBusinessStatus}
        formatBusinessType={formatBusinessType}
        onBack={() => undefined}
        onCreateBusiness={onCreateBusiness}
        onRefresh={() => undefined}
        onSelectBusiness={() => undefined}
      />
    );

    expect(screen.getByText("Create your first business to get started.")).toBeTruthy();
    fireEvent.press(screen.getByText("Create business"));
    expect(onCreateBusiness).toHaveBeenCalledTimes(1);
  });
});

describe("BookingConfirmationScreen", () => {
  const confirmation = {
    businessName: "RK Barber",
    serviceName: "Haircut",
    staffName: "Sam",
    startsAt: "2030-07-02T07:30:00.000Z",
    timezone: "Asia/Amman"
  };

  it("renders confirmation details without ISO timestamps", () => {
    render(<BookingConfirmationScreen confirmation={confirmation} onDone={() => undefined} />);

    expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    expect(screen.getByText("RK Barber")).toBeTruthy();
    expect(screen.getByText("Haircut")).toBeTruthy();
    expect(screen.queryByText(/2030-07-02T/)).toBeNull();
  });

  it("sends guests back to Explore instead of Schedule", () => {
    const onDone = jest.fn();
    render(<BookingConfirmationScreen confirmation={confirmation} onDone={onDone} />);

    expect(screen.getByText("Back to Explore")).toBeTruthy();
    expect(screen.queryByText("View Schedule")).toBeNull();
    fireEvent.press(screen.getByText("Back to Explore"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps View Schedule for account-backed confirmations", () => {
    const onViewSchedule = jest.fn();
    render(
      <BookingConfirmationScreen
        confirmation={confirmation}
        onDone={() => undefined}
        onViewSchedule={onViewSchedule}
      />
    );

    expect(screen.getByText("View Schedule")).toBeTruthy();
    fireEvent.press(screen.getByText("View Schedule"));
    expect(onViewSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("App session logout and refresh failure", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn(mockConsumerApi) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends the current refresh token to /auth/logout", async () => {
    render(<App />);
    await signInFromProfile();

    fireEvent.press(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(screen.getByText("Your account")).toBeTruthy();
    });

    const logoutCall = findFetchCall("/auth/logout");
    expect(logoutCall).toBeTruthy();
    expect(JSON.parse(String(logoutCall?.[1]?.body))).toEqual({ refreshToken: "refresh-token" });
  });

  it("clears the signed-in UI when /auth/logout fails", async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (fetchPathname(input).endsWith("/auth/logout")) {
        return jsonResponse({ message: "Server error" }, 500);
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await signInFromProfile();

    fireEvent.press(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(screen.getByText("Your account")).toBeTruthy();
      expect(screen.queryByText("client@example.com")).toBeNull();
      expect(screen.getByText("Sign in")).toBeTruthy();
    });
  });

  it("returns to the signed-out state when token refresh fails", async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const pathname = fetchPathname(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && pathname.endsWith("/auth/refresh")) {
        return jsonResponse({ message: "Invalid refresh token" }, 401);
      }

      if (method === "GET" && pathname.endsWith("/me/appointments")) {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      return mockConsumerApi(input, init);
    }) as unknown as typeof fetch;

    render(<App />);
    await signInFromProfile();
    pressConsumerTab("Home");

    await waitFor(() => {
      expect(screen.getByText("Your account")).toBeTruthy();
      expect(screen.queryByText("client@example.com")).toBeNull();
    });
  });
});
