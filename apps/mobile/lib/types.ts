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

export interface PublicBusinessProfile {
  address: string | null;
  businessHours: Array<{
    closeTime: string | null;
    dayOfWeek: number;
    id: string;
    isClosed: boolean;
    openTime: string | null;
  }>;
  businessType: string;
  city: string | null;
  id: string;
  name: string;
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
  timezone: string;
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
