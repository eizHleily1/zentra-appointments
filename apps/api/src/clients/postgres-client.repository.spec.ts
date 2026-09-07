import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { validateEnvironment } from "../config/environment";
import { DatabaseService } from "../database/database.service";
import { PostgresClientRepository } from "./postgres-client.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev";

const schemaFiles = ["iteration-14-client-phone-name-identity.sql", "iteration-15-booking-phone-verification.sql"];

const NORMALIZED_PHONE = "5551234567";
const NORMALIZED_NAME = "maria lopez";

/**
 * Exercises the real SQL behind the linked/unlinked split. The in-memory double reimple-
 * ments this predicate independently, so an inverted boolean here would otherwise let a
 * guest booking reuse a registered user's client with the whole suite still green.
 */
describe("PostgresClientRepository identity lookup", () => {
  let databaseService: DatabaseService;
  let repository: PostgresClientRepository;
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
      imports: [ConfigModule.forRoot({ validate: validateEnvironment })],
      providers: [DatabaseService, PostgresClientRepository]
    }).compile();

    databaseService = moduleRef.get(DatabaseService);
    repository = moduleRef.get(PostgresClientRepository);
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

  it("stores a linked and an unlinked twin with the same business, phone, and name", async () => {
    const { businessId, userId } = await seedBusiness();

    const unlinkedId = await seedClient(businessId, null);
    const linkedId = await seedClient(businessId, userId);

    expect(unlinkedId).not.toBe(linkedId);
  });

  it("ignores the linked twin when looking up an unlinked identity", async () => {
    const { businessId, userId } = await seedBusiness();
    const unlinkedId = await seedClient(businessId, null);
    await seedClient(businessId, userId);

    const match = await repository.findActiveClientMatchingIdentity({
      businessId,
      linkage: "unlinked",
      normalizedDisplayName: NORMALIZED_NAME,
      normalizedPhone: NORMALIZED_PHONE
    });

    expect(match?.id).toBe(unlinkedId);
    expect(match?.linkedUserId).toBeNull();
  });

  it("ignores the unlinked twin when looking up a linked identity", async () => {
    const { businessId, userId } = await seedBusiness();
    await seedClient(businessId, null);
    const linkedId = await seedClient(businessId, userId);

    const match = await repository.findActiveClientMatchingIdentity({
      businessId,
      linkage: "linked",
      normalizedDisplayName: NORMALIZED_NAME,
      normalizedPhone: NORMALIZED_PHONE
    });

    expect(match?.id).toBe(linkedId);
    expect(match?.linkedUserId).toBe(userId);
  });

  it("finds nothing for a linkage class that has no member", async () => {
    const { businessId } = await seedBusiness();
    await seedClient(businessId, null);

    await expect(
      repository.findActiveClientMatchingIdentity({
        businessId,
        linkage: "linked",
        normalizedDisplayName: NORMALIZED_NAME,
        normalizedPhone: NORMALIZED_PHONE
      })
    ).resolves.toBeNull();
  });

  it("excludes the record being edited so an owner update does not collide with itself", async () => {
    const { businessId, userId } = await seedBusiness();
    const unlinkedId = await seedClient(businessId, null);
    await seedClient(businessId, userId);

    await expect(
      repository.findActiveClientMatchingIdentity({
        businessId,
        excludeClientId: unlinkedId,
        linkage: "unlinked",
        normalizedDisplayName: NORMALIZED_NAME,
        normalizedPhone: NORMALIZED_PHONE
      })
    ).resolves.toBeNull();
  });

  it("ignores deactivated clients and other businesses", async () => {
    const { businessId } = await seedBusiness();
    const other = await seedBusiness();
    const deactivatedId = await seedClient(businessId, null);
    await seedClient(other.businessId, null);

    await databaseService.query("UPDATE clients SET active = false WHERE id = $1", [deactivatedId]);

    await expect(
      repository.findActiveClientMatchingIdentity({
        businessId,
        linkage: "unlinked",
        normalizedDisplayName: NORMALIZED_NAME,
        normalizedPhone: NORMALIZED_PHONE
      })
    ).resolves.toBeNull();
  });

  it("matches on normalized phone and name rather than stored formatting", async () => {
    const { businessId } = await seedBusiness();
    const clientId = randomUUID();

    await databaseService.query(
      `
        INSERT INTO clients (id, business_id, display_name, phone_number, email, linked_user_id, active)
        VALUES ($1, $2, '  Maria Lopez  ', '+1 (555) 123-4567', NULL, NULL, true)
      `,
      [clientId, businessId]
    );

    const match = await repository.findActiveClientMatchingIdentity({
      businessId,
      linkage: "unlinked",
      normalizedDisplayName: NORMALIZED_NAME,
      normalizedPhone: `1${NORMALIZED_PHONE}`
    });

    expect(match?.id).toBe(clientId);
  });

  async function seedClient(businessId: string, linkedUserId: string | null): Promise<string> {
    const clientId = randomUUID();

    await databaseService.query(
      `
        INSERT INTO clients (id, business_id, display_name, phone_number, email, linked_user_id, active)
        VALUES ($1, $2, 'Maria Lopez', '555-123-4567', NULL, $3, true)
      `,
      [clientId, businessId, linkedUserId]
    );

    return clientId;
  }

  async function seedBusiness(): Promise<{ businessId: string; userId: string }> {
    const userId = randomUUID();
    const businessId = randomUUID();

    await databaseService.query(
      "INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'not-used', 'ACTIVE')",
      [userId, `client-identity-${userId}@example.com`]
    );
    createdUserIds.push(userId);

    await databaseService.query(
      `
        INSERT INTO tenants (id, name, business_type, timezone, status, initial_owner_user_id)
        VALUES ($1, 'Identity Shop', 'BARBER', 'UTC', 'ACTIVE', $2)
      `,
      [businessId, userId]
    );
    createdBusinessIds.push(businessId);

    return { businessId, userId };
  }
});
