export const BUSINESS_HOURS_REPOSITORY = Symbol("BUSINESS_HOURS_REPOSITORY");

export interface BusinessHour {
  businessId: string;
  closeTime: string | null;
  dayOfWeek: number;
  id: string;
  isClosed: boolean;
  openTime: string | null;
}

export interface UpsertBusinessHourInput {
  businessId: string;
  closeTime: string | null;
  dayOfWeek: number;
  id: string;
  isClosed: boolean;
  openTime: string | null;
}

export interface BusinessHoursRepository {
  findBusinessHours(businessId: string): Promise<BusinessHour[]>;
  replaceBusinessHours(businessId: string, hours: UpsertBusinessHourInput[]): Promise<BusinessHour[]>;
}
