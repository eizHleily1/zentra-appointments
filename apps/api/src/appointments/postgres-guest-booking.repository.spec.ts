import { DatabaseService } from "../database/database.service";
import { PostgresGuestBookingRepository } from "./postgres-guest-booking.repository";

describe("PostgresGuestBookingRepository", () => {
  it("runs guest client and appointment writes in one transaction that rolls back on failure", async () => {
    const queries: string[] = [];
    let began = false;
    let rolledBack = false;
    const tx = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("INSERT INTO appointments")) {
          throw { code: "23P01" };
        }

        if (sql.includes("INSERT INTO clients")) {
          return {
            rows: [
              {
                active: true,
                business_id: "business-1",
                created_at: new Date(),
                display_name: "Maria Lopez",
                email: null,
                id: "client-1",
                linked_user_id: null,
                phone_number: "555-123-4567",
                updated_at: new Date()
              }
            ]
          };
        }

        return { rows: [] };
      })
    };
    const databaseService = {
      transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
        began = true;
        try {
          return await callback(tx);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      }
    } as unknown as DatabaseService;
    const repository = new PostgresGuestBookingRepository(databaseService);

    await expect(
      repository.createGuestBooking({
        appointment: {
          businessId: "business-1",
          endsAt: new Date("2030-07-02T07:30:00.000Z"),
          id: "appointment-1",
          serviceDurationMinutes: 30,
          serviceId: "service-1",
          serviceName: "Haircut",
          servicePrice: 15,
          staffDisplayName: "Alex",
          staffMemberId: "staff-1",
          startsAt: new Date("2030-07-02T07:00:00.000Z")
        },
        guest: {
          businessId: "business-1",
          displayName: "Maria Lopez",
          normalizedDisplayName: "maria lopez",
          normalizedPhone: "5551234567",
          phoneNumber: "555-123-4567"
        }
      })
    ).rejects.toMatchObject({ code: "23P01" });

    expect(began).toBe(true);
    expect(rolledBack).toBe(true);
    expect(queries.some((sql) => sql.includes("INSERT INTO clients"))).toBe(true);
    expect(queries.some((sql) => sql.includes("INSERT INTO appointments"))).toBe(true);
  });
});
