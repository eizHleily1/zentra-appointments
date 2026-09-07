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

const schemaFiles = [
  "iteration-14-client-phone-name-identity.sql",
  "iteration-15-booking-phone-verification.sql",
  "iteration-16-client-name-identity.sql"
];

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

        if (sql.includes("UPDATE booking_phone_verifications")) {
          return { rows: [{ id: "verification-1" }] };
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
    expect(queries[0]).toContain("UPDATE booking_phone_verifications");
    expect(queries.some((sql) => sql.includes("INSERT INTO clients") && sql.includes("ON CONFLICT DO NOTHING"))).toBe(
      true
    );
    expect(queries.some((sql) => sql.includes("INSERT INTO appointments"))).toBe(true);
  });

  it("refuses to write anything when the verification cannot be consumed", async () => {
    const queries: string[] = [];
    const tx = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [] };
      })
    };
    const databaseService = {
      transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    } as unknown as DatabaseService;
    const repository = new PostgresGuestBookingRepository(databaseService);

    await expect(repository.createGuestBooking(guestBookingInput("appointment-1", "10:00", "10:30"))).rejects.toThrow(
      "Verify your phone number before booking"
    );

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("UPDATE booking_phone_verifications");
  });

  it("looks up the winning guest client when insert hits a unique conflict without aborting the transaction", async () => {
    let clientLookups = 0;
    const tx = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("UPDATE booking_phone_verifications")) {
          return { rows: [{ id: "verification-1" }] };
        }

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
        normalizedPhone: "5551234567",
        phoneNumber: "555-123-4567"
      };

      const results = await Promise.all([
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "10:00", "10:30", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId,
            verificationId: await seedVerifiedChallenge(setup.businessId)
          })
        ),
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "10:30", "11:00", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId,
            verificationId: await seedVerifiedChallenge(setup.businessId)
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
            AND normalize_client_display_name(display_name) = normalize_client_display_name($3)
        `,
        [setup.businessId, guest.normalizedPhone, guest.displayName]
      );
      const appointments = await databaseService.query<{ id: string; client_id: string }>(
        "SELECT id, client_id FROM appointments WHERE business_id = $1 ORDER BY starts_at ASC",
        [setup.businessId]
      );

      expect(clients.rows).toHaveLength(1);
      expect(appointments.rows).toHaveLength(2);
      expect(appointments.rows.every((row) => row.client_id === clients.rows[0].id)).toBe(true);
    });

    it("lets only one of two concurrent bookings consume the same verified challenge", async () => {
      const setup = await seedBookableBusiness();
      const verificationId = await seedVerifiedChallenge(setup.businessId);

      const results = await Promise.allSettled([
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "10:00", "10:30", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId,
            verificationId
          })
        ),
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "11:00", "11:30", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId,
            verificationId
          })
        )
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        results.filter(
          (result) =>
            result.status === "rejected" &&
            String(result.reason?.message).includes("Verify your phone number before booking")
        )
      ).toHaveLength(1);

      const appointments = await databaseService.query<{ id: string }>(
        "SELECT id FROM appointments WHERE business_id = $1",
        [setup.businessId]
      );
      const verifications = await databaseService.query<{ consumed_at: Date | null }>(
        "SELECT consumed_at FROM booking_phone_verifications WHERE id = $1",
        [verificationId]
      );

      expect(appointments.rows).toHaveLength(1);
      expect(verifications.rows[0].consumed_at).not.toBeNull();
    });

    it("rejects a challenge that was verified for a different business", async () => {
      const setup = await seedBookableBusiness();
      const otherBusiness = await seedBookableBusiness();
      const verificationId = await seedVerifiedChallenge(otherBusiness.businessId);

      await expect(
        repository.createGuestBooking(
          guestBookingInput(randomUUID(), "10:00", "10:30", {
            businessId: setup.businessId,
            serviceId: setup.serviceId,
            staffMemberId: setup.staffMemberId,
            verificationId
          })
        )
      ).rejects.toThrow("Verify your phone number before booking");

      const clients = await databaseService.query<{ id: string }>(
        "SELECT id FROM clients WHERE business_id = $1",
        [setup.businessId]
      );

      expect(clients.rows).toHaveLength(0);
    });

    it("creates a separate unlinked guest client instead of reusing a linked one", async () => {
      const setup = await seedBookableBusiness();
      const linkedClientId = randomUUID();
      await databaseService.query(
        `
          INSERT INTO clients (id, business_id, display_name, phone_number, email, linked_user_id, active)
          VALUES ($1, $2, 'Maria Lopez', '555-123-4567', NULL, $3, true)
        `,
        [linkedClientId, setup.businessId, setup.userId]
      );

      const booked = await repository.createGuestBooking(
        guestBookingInput(randomUUID(), "10:00", "10:30", {
          businessId: setup.businessId,
          serviceId: setup.serviceId,
          staffMemberId: setup.staffMemberId,
          verificationId: await seedVerifiedChallenge(setup.businessId)
        })
      );

      expect(booked.client.id).not.toBe(linkedClientId);
      expect(booked.client.linkedUserId).toBeNull();
    });

    it("reuses one guest client for Unicode names that JavaScript and PostgreSQL case-fold differently", async () => {
      const setup = await seedBookableBusiness();
      const displayName = "İpek";
      const ids = {
        businessId: setup.businessId,
        serviceId: setup.serviceId,
        staffMemberId: setup.staffMemberId
      };

      const first = await repository.createGuestBooking(
        guestBookingInput(randomUUID(), "10:00", "10:30", {
          ...ids,
          displayName,
          verificationId: await seedVerifiedChallenge(setup.businessId)
        })
      );
      const second = await repository.createGuestBooking(
        guestBookingInput(randomUUID(), "10:30", "11:00", {
          ...ids,
          displayName: `  ${displayName}  `,
          verificationId: await seedVerifiedChallenge(setup.businessId)
        })
      );

      expect(first.client.id).toBe(second.client.id);
      expect(first.client.displayName).toBe(displayName);

      const clients = await databaseService.query<{ id: string; display_name: string }>(
        `
          SELECT id, display_name
          FROM clients
          WHERE business_id = $1
            AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $2
            AND normalize_client_display_name(display_name) = normalize_client_display_name($3)
        `,
        [setup.businessId, "5551234567", displayName]
      );

      expect(clients.rows).toHaveLength(1);
      expect(clients.rows[0].display_name).toBe(displayName);
    });

    async function seedVerifiedChallenge(businessId: string, normalizedPhone = "5551234567"): Promise<string> {
      const verificationId = randomUUID();

      await databaseService.query(
        `
          INSERT INTO booking_phone_verifications (
            id,
            business_id,
            normalized_phone,
            code_hash,
            expires_at,
            attempts_remaining,
            verified_at
          )
          VALUES ($1, $2, $3, 'hashed-code', now() + interval '5 minutes', 5, now())
        `,
        [verificationId, businessId, normalizedPhone]
      );

      return verificationId;
    }

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

      return { businessId, serviceId, staffMemberId, userId };
    }
  });
});

function guestBookingInput(
  appointmentId: string,
  startTime: string,
  endTime: string,
  ids?: {
    businessId: string;
    displayName?: string;
    serviceId: string;
    staffMemberId: string;
    verificationId?: string;
  }
) {
  const businessId = ids?.businessId ?? "business-1";

  return {
    verificationId: ids?.verificationId ?? "verification-1",
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
      displayName: ids?.displayName ?? "Maria Lopez",
      normalizedPhone: "5551234567",
      phoneNumber: "555-123-4567"
    }
  };
}
