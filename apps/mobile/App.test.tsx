import { render, screen } from "@testing-library/react-native";
import App, {
  AppointmentCard,
  BookAppointmentScreen,
  BusinessProfileScreen,
  buildBookAppointmentPayload,
  buildConsumerBookAppointmentPayload,
  CategoryBusinessListScreen,
  formatAppointmentStatus,
  formatAppointmentTimeRange,
  formatServicePriceLabel
} from "./App";
import { ExploreTabScreen } from "./screens/consumer/ExploreTabScreen";
import { ConsumerAppointmentCard } from "./components/ConsumerAppointmentCard";
import { BookingConfirmationScreen } from "./screens/consumer/BookingConfirmationScreen";
import { formatServicePriceDisplay } from "./lib/formatters";

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

describe("BusinessProfileScreen", () => {
  it("renders services and staff", () => {
    render(
      <BusinessProfileScreen
        business={{
          address: null,
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
        }}
        onBack={() => undefined}
        onBook={() => undefined}
      />
    );

    expect(screen.getByText("Haircut")).toBeTruthy();
    expect(screen.getByText("Alex")).toBeTruthy();
    expect(screen.getByText("Book appointment")).toBeTruthy();
    expect(screen.queryByText(/00000000-0000-4000-8000-000000000011/)).toBeNull();
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
  it("does not include clientId", () => {
    const payload = buildConsumerBookAppointmentPayload({
      serviceId: "00000000-0000-4000-8000-000000000002",
      staffMemberId: "00000000-0000-4000-8000-000000000003",
      startTime: "2030-07-02T07:00:00.000Z"
    });

    expect(payload).toEqual({
      serviceId: "00000000-0000-4000-8000-000000000002",
      staffMemberId: "00000000-0000-4000-8000-000000000003",
      startTime: "2030-07-02T07:00:00.000Z"
    });
    expect(payload).not.toHaveProperty("clientId");
  });
});

describe("ConsumerAppointmentCard", () => {
  it("does not render UUIDs or ISO timestamps", () => {
    render(
      <ConsumerAppointmentCard
        appointment={{
          businessName: "Downtown Barber",
          businessTimezone: "Asia/Amman",
          endsAt: "2030-07-02T07:30:00.000Z",
          id: "00000000-0000-4000-8000-000000000099",
          serviceName: "Haircut",
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

describe("AppointmentCard", () => {
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

  it("renders clientDisplayName", () => {
    render(
      <AppointmentCard
        appointment={baseAppointment}
        businessId="business-1"
        onActionComplete={noopAsync}
        request={noopAsync as never}
        run={noopAsync as never}
        timezone="Asia/Amman"
      />
    );

    expect(screen.getByText("Maria Lopez")).toBeTruthy();
  });

  it("still renders owner appointment actions", () => {
    render(
      <AppointmentCard
        appointment={baseAppointment}
        businessId="business-1"
        onActionComplete={noopAsync}
        request={noopAsync as never}
        run={noopAsync as never}
        timezone="Asia/Amman"
      />
    );

    expect(screen.getByText("Complete")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
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

describe("BookingConfirmationScreen", () => {
  it("renders confirmation details without ISO timestamps", () => {
    render(
      <BookingConfirmationScreen
        confirmation={{
          businessName: "RK Barber",
          serviceName: "Haircut",
          staffName: "Sam",
          startsAt: "2030-07-02T07:30:00.000Z",
          timezone: "Asia/Amman"
        }}
        onDone={() => undefined}
        onViewSchedule={() => undefined}
      />
    );

    expect(screen.getByText("Appointment confirmed")).toBeTruthy();
    expect(screen.getByText("RK Barber")).toBeTruthy();
    expect(screen.getByText("Haircut")).toBeTruthy();
    expect(screen.queryByText(/2030-07-02T/)).toBeNull();
  });
});
