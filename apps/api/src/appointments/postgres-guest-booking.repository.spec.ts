import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Pool } from "pg";
import { validateEnvironment } from "../config/environment";
import { DatabaseService } from "../database/database.service";
import { PostgresGuestBookingRepository } from "./postgres-guest-booking.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev";

const schemaFiles = ["iteration-14-client-phone-name-identity.sql"];

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

    await expect(repository.createGuestBooking(guestBookingInput("appointment-1", "10:00", "10:30"))).rejects.toMatchObject({
      code: "23P01"
    });

    expect(began).toBe(true);
    expect(rolledBack).toBe(true);
    expect(queries.some((sql) => sql.includes("INSERT INTO clients") && sql.includes("ON CONFLICT DO NOTHING"))).toBe(
      true
    );
    expect(queries.some((sql) => sql.includes("INSERT INTO appointments"))).toBe(true);
  });

  it("looks up the winning guest client when insert hits a unique conflict without aborting the transaction", async () => {
    let clientLookups = 0;
    const tx = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO clients")) {
          return { rows: [] };
        }

        if (sql.includes("INSERT INTO appointments")) {
          return {
            rows: [
              {
                business_id: "business-1",
                client_display_name: "Maria Lopez",
                client_id: "client-winner",
                client_phone_number: "555-123-4567",
                created_at: new Date(),
                ends_at: new Date("2030-07-02T07:30:00.000Z"),
                id: "appointment-1",
                service_duration_minutes: 30,
                service_id: "service-1",
                service_name: "Haircut",
                service_price: "15",
                staff_display_name: "Alex",
                staff_member_id: "staff-1",
                starts_at: new Date("2030-07-02T07:00:00.000Z"),
                status: "BOOKED",
                updated_at: new Date()
              }
            ]
          };
        }

        if (sql.includes("FROM clients")) {
          clientLookups += 1;

          if (clientLookups === 1) {
            return { rows: [] };
          }

          return {
            rows: [
              {
                active: true,
                business_id: "business-1",
                created_at: new Date(),
                display_name: "Maria Lopez",
                email: null,
                id: "client-winner",
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
      transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    } as unknown as DatabaseService;
    const repository = new PostgresGuestBookingRepository(databaseService);

    const booked = await repository.createGuestBooking(guestBookingInput("appointment-1", "10:00", "10:30"));

    expect(booked.client.id).toBe("client-winner");
    expect(booked.appointment.clientId).toBe("client-winner");
    expect(tx.query.mock.calls.some((call) => String(call[0]).includes("ON CONFLICT DO NOTHING"))).toBe(true);
  });

  describe("concurrent guest identity against PostgreSQL", () => {
    let databaseService: DatabaseService;
    let repository: PostgresGuestBookingRepository;
    const createdBusinessIds: string[] = [];
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      const pool = new Pool({ connectionString: databaseUrl });

      try {
        for (const fileName of schemaFiles) {
          await pool.query(readFileSync(join(__dirname, `../../db/${fileName}`), "utf8"));
        }
      } finally {
        await pool.end();
      }

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            validate: validateEnvironment
          })
        ],
        providers: [DatabaseService, PostgresGuestBookingRepository]
      }).compile();

      databaseService = moduleRef.get(DatabaseService);
      repository = moduleRef.get(PostgresGuestBookingRepository);
    });

    afterEach(async () => {
      while (createdBusinessIds.length > 0) {
        const businessId = createdBusinessIds.pop();

        if (businessId) {
          await databaseService.query("DELETE FROM tenants WHERE id = $1", [businessId]);
        }
      }

      while (createdUserIds.length > 0) {
        const userId = createdUserIds.pop();

        if (userId) {
          await databaseService.query("DELETE FROM users WHERE id = $1", [userId]);
        }
      }
    });

    afterAll(async () => {
      await databaseService?.onModuleDestroy();
    });

    it("reuses one guest client for concurrent bookings on different slots without aborting the loser transaction", async () => {
      const setup = await seedBookableBusiness();
      const guest = {
        businessId: setup.businessId,
        displayName: "Maria Lopez",
        normalizedDisplayName: "maria lopez",
        normalizedPhone: "5551234567",
        phoneNumber: "555-123-4567"
      };

      const results = await Promise.all([
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "10:00", "10:30", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId
          })
        ),
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "10:30", "11:00", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId
          })
        )
      ]);

      expect(results[0].client.id).toBe(results[1].client.id);
      expect(new Set(results.map((result) => result.appointment.id)).size).toBe(2);

      const clients = await databaseService.query<{ id: string }>(
        `
          SELECT id
          FROM clients
          WHERE business_id = $1
            AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $2
            AND lower(btrim(display_name)) = $3
        `,
        [setup.businessId, guest.normalizedPhone, guest.normalizedDisplayName]
      );
      const appointments = await databaseService.query<{ id: string; client_id: string }>(
        "SELECT id, client_id FROM appointments WHERE business_id = $1 ORDER BY starts_at ASC",
        [setup.businessId]
      );

      expect(clients.rows).toHaveLength(1);
      expect(appointments.rows).toHaveLength(2);
      expect(appointments.rows.every((row) => row.client_id === clients.rows[0].id)).toBe(true);
    });

    async function seedBookableBusiness() {
      const userId = randomUUID();
      const businessId = randomUUID();
      const serviceId = randomUUID();
      const staffMemberId = randomUUID();

      await databaseService.query(
        `
          INSERT INTO users (id, email, password_hash, status)
          VALUES ($1, $2, 'not-used', 'ACTIVE')
        `,
        [userId, `guest-race-${userId}@example.com`]
      );
      createdUserIds.push(userId);

      await databaseService.query(
        `
          INSERT INTO tenants (id, name, business_type, timezone, status, initial_owner_user_id)
          VALUES ($1, 'Race Shop', 'BARBER', 'UTC', 'ACTIVE', $2)
        `,
        [businessId, userId]
      );
      createdBusinessIds.push(businessId);

      await databaseService.query(
        `
          INSERT INTO services (id, business_id, name, description, duration_minutes, price, active)
          VALUES ($1, $2, 'Haircut', 'Cut', 30, 15, true)
        `,
        [serviceId, businessId]
      );
      await databaseService.query(
        `
          INSERT INTO staff_members (id, user_id, business_id, display_name, active)
          VALUES ($1, $2, $3, 'Alex', true)
        `,
        [staffMemberId, userId, businessId]
      );

      return { businessId, serviceId, staffMemberId };
    }
  });
});

function guestBookingInput(
  appointmentId: string,
  startTime: string,
  endTime: string,
  ids?: { businessId: string; serviceId: string; staffMemberId: string }
) {
  const businessId = ids?.businessId ?? "business-1";

  return {
    appointment: {
      businessId,
      endsAt: new Date(`2030-07-02T${endTime}:00.000Z`),
      id: appointmentId,
      serviceDurationMinutes: 30,
      serviceId: ids?.serviceId ?? "service-1",
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Alex",
      staffMemberId: ids?.staffMemberId ?? "staff-1",
      startsAt: new Date(`2030-07-02T${startTime}:00.000Z`)
    },
    guest: {
      businessId,
      displayName: "Maria Lopez",
      normalizedDisplayName: "maria lopez",
      normalizedPhone: "5551234567",
      phoneNumber: "555-123-4567"
    }
  };
}
