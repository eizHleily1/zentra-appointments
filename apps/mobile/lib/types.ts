export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

export interface Business {
  businessType: string;
  city?: string | null;
  id: string;
  name: string;
  status: string;
  timezone: string;
}

export interface PublishReadiness {
  canPublish: boolean;
  missingSteps: string[];
  requirements: {
    hasCity: boolean;
    hasService: boolean;
    hasStaff: boolean;
  };
  status: string;
}

export interface BusinessService {
  active: boolean;
  businessId: string;
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
  price: number | null;
}

export interface StaffMember {
  active: boolean;
  businessId: string;
  displayName: string;
  id: string;
  userId: string;
}

export interface Client {
  active: boolean;
  businessId: string;
  displayName: string;
  email: string | null;
  id: string;
  linkedUserId: string | null;
  phoneNumber: string | null;
}

export interface Appointment {
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

export interface BusinessHour {
  closeTime: string | null;
  dayOfWeek: number;
  id: string;
  isClosed: boolean;
  openTime: string | null;
}

export interface AvailableSlot {
  endTime: string;
  label: string;
  startTime: string;
}

export interface PublicBusinessSummary {
  address: string | null;
  businessType: string;
  city: string | null;
  id: string;
  name: string;
  timezone: string;
}

export interface PublicBusinessProfile extends PublicBusinessSummary {
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

export interface BookingConfirmationDetails {
  businessName: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  timezone: string;
}

export interface PendingBookingState {
  business: PublicBusinessProfile;
  resumeStep: "book";
}

export interface ConsumerAppointment extends Appointment {
  businessName: string;
  businessTimezone: string;
}

export type Tab = "home" | "appointments" | "services" | "staff" | "settings";

export type OverlayScreen = "book" | "business-hours" | null;

export type AppArea = "consumer" | "owner";

export type ClientScreen = "home" | "profile" | "book" | "confirmed";

export type DiscoveryCategoryId =
  | "BARBER"
  | "BEAUTY"
  | "CLINIC"
  | "COACHING"
  | "DENTIST"
  | "FITNESS"
  | "OTHER";

export type ApiRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

export type RunAction = (action: () => Promise<void>, successMessage?: string) => Promise<void>;
