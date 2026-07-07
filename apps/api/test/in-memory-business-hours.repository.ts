import type {
  BusinessHour,
  BusinessHoursRepository,
  UpsertBusinessHourInput
} from "../src/businesses/business-hours.repository";

export class InMemoryBusinessHoursRepository implements BusinessHoursRepository {
  private readonly hoursByBusiness = new Map<string, BusinessHour[]>();

  async findBusinessHours(businessId: string): Promise<BusinessHour[]> {
    return [...(this.hoursByBusiness.get(businessId) ?? [])].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
  }

  async replaceBusinessHours(businessId: string, hours: UpsertBusinessHourInput[]): Promise<BusinessHour[]> {
    const nextHours = hours.map((hour) => ({
      businessId,
      closeTime: hour.closeTime,
      dayOfWeek: hour.dayOfWeek,
      id: hour.id,
      isClosed: hour.isClosed,
      openTime: hour.openTime
    }));

    this.hoursByBusiness.set(businessId, nextHours);
    return this.findBusinessHours(businessId);
  }
}
