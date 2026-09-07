import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { validateEnvironment } from "../config/environment";
import { DatabaseService } from "../database/database.service";
import {
  BookingVerificationCooldownError,
  type CreateBookingPhoneVerificationInput
} from "./booking-verification.repository";
import { PostgresBookingVerificationRepository } from "./postgres-booking-verification.repository";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev";

const schemaFiles = ["iteration-14-client-phone-name-identity.sql", "iteration-15-booking-phone-verification.sql"];

const NORMALIZED_PHONE = "5551234567";

describe("PostgresBookingVerificationRepository", () => {
  let databaseService: DatabaseService;
  let repository: PostgresBookingVerificationRepository;
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
      providers: [DatabaseService, PostgresBookingVerificationRepository]
    }).compile();

    databaseService = moduleRef.get(DatabaseService);
    repository = moduleRef.get(PostgresBookingVerificationRepository);
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

  describe("claimVerificationAttempt", () => {
    it("lets only one of two concurrent claims spend the last remaining attempt", async () => {
      const businessId = await seedBusiness();
      const verificationId = await seedChallenge(businessId, { attemptsRemaining: 1 });

      const claims = await Promise.all([
        repository.claimVerificationAttempt(businessId, verificationId),
        repository.claimVerificationAttempt(businessId, verificationId)
      ]);

      expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
      expect(await readAttemptsRemaining(verificationId)).toBe(0);
    });

    it("never lets concurrent claims exceed the configured attempt budget", async () => {
      const businessId = await seedBusiness();
      const verificationId = await seedChallenge(businessId, { attemptsRemaining: 3 });

      const claims = await Promise.all(
        Array.from({ length: 8 }, () => repository.claimVerificationAttempt(businessId, verificationId))
      );

      expect(claims.filter((claim) => claim !== null)).toHaveLength(3);
      expect(await readAttemptsRemaining(verificationId)).toBe(0);
    });

    it("refuses every later claim once the attempts are exhausted", async () => {
      const businessId = await seedBusiness();
      const verificationId = await seedChallenge(businessId, { attemptsRemaining: 1 });

      expect(await repository.claimVerificationAttempt(businessId, verificationId)).not.toBeNull();
      expect(await repository.claimVerificationAttempt(businessId, verificationId)).toBeNull();
    });

    it("returns the code hash so the caller can only check a code it paid an attempt for", async () => {
      const businessId = await seedBusiness();
      const verificationId = await seedChallenge(businessId, { attemptsRemaining: 5 });

      const claimed = await repository.claimVerificationAttempt(businessId, verificationId);

      expect(claimed?.codeHash).toBe("hashed-code");
      expect(claimed?.attemptsRemaining).toBe(4);
    });

    it("refuses expired, consumed, verified, and cross-business challenges", async () => {
      const businessId = await seedBusiness();
      const otherBusinessId = await seedBusiness();

      const expired = await seedChallenge(businessId, { expiresInSeconds: -1 });
      const verified = await seedChallenge(businessId, { verified: true });
      const consumed = await seedChallenge(businessId, { consumed: true, verified: true });
      const usable = await seedChallenge(businessId, {});

      expect(await repository.claimVerificationAttempt(businessId, expired)).toBeNull();
      expect(await repository.claimVerificationAttempt(businessId, verified)).toBeNull();
      expect(await repository.claimVerificationAttempt(businessId, consumed)).toBeNull();
      expect(await repository.claimVerificationAttempt(otherBusinessId, usable)).toBeNull();
      expect(await repository.claimVerificationAttempt(businessId, randomUUID())).toBeNull();
    });
  });

  describe("issueVerification", () => {
    it("issues one challenge and delivers one message for concurrent requests in the cooldown window", async () => {
      const businessId = await seedBusiness();
      const delivered: string[] = [];

      const results = await Promise.allSettled([
        repository.issueVerification(challengeInput(businessId), async (verification) => {
          delivered.push(verification.id);
        }),
        repository.issueVerification(challengeInput(businessId), async (verification) => {
          delivered.push(verification.id);
        })
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        results.filter(
          (result) => result.status === "rejected" && result.reason instanceof BookingVerificationCooldownError
        )
      ).toHaveLength(1);
      expect(delivered).toHaveLength(1);
      expect(await countChallenges(businessId)).toBe(1);
    });

    it("keeps concurrent requests for different phone numbers independent", async () => {
      const businessId = await seedBusiness();

      const results = await Promise.all([
        repository.issueVerification(challengeInput(businessId, { normalizedPhone: "5551110000" }), noopDeliver),
        repository.issueVerification(challengeInput(businessId, { normalizedPhone: "5552220000" }), noopDeliver)
      ]);

      expect(new Set(results.map((result) => result.id)).size).toBe(2);
      expect(await countChallenges(businessId)).toBe(2);
    });

    it("rolls the challenge back when delivery fails, so the guest is not stuck in a cooldown", async () => {
      const businessId = await seedBusiness();

      await expect(
        repository.issueVerification(challengeInput(businessId), async () => {
          throw new Error("SMS provider unavailable");
        })
      ).rejects.toThrow("SMS provider unavailable");

      expect(await countChallenges(businessId)).toBe(0);

      // The failed send left nothing behind, so an immediate retry is allowed.
      await expect(repository.issueVerification(challengeInput(businessId), noopDeliver)).resolves.toBeDefined();
      expect(await countChallenges(businessId)).toBe(1);
    });

    it("allows a new challenge once the cooldown window has passed", async () => {
      const businessId = await seedBusiness();
      const first = await repository.issueVerification(challengeInput(businessId), noopDeliver);

      await expect(repository.issueVerification(challengeInput(businessId), noopDeliver)).rejects.toBeInstanceOf(
        BookingVerificationCooldownError
      );

      await databaseService.query(
        "UPDATE booking_phone_verifications SET created_at = now() - interval '2 minutes' WHERE id = $1",
        [first.id]
      );

      await expect(repository.issueVerification(challengeInput(businessId), noopDeliver)).resolves.toBeDefined();
      expect(await countChallenges(businessId)).toBe(2);
    });

    it("skips the cooldown entirely when it is configured to zero", async () => {
      const businessId = await seedBusiness();

      await repository.issueVerification(challengeInput(businessId, { cooldownSeconds: 0 }), noopDeliver);
      await repository.issueVerification(challengeInput(businessId, { cooldownSeconds: 0 }), noopDeliver);

      expect(await countChallenges(businessId)).toBe(2);
    });
  });

  describe("markVerificationVerified", () => {
    it("refuses to verify a consumed or expired challenge", async () => {
      const businessId = await seedBusiness();
      const consumed = await seedChallenge(businessId, { consumed: true, verified: true });
      const expired = await seedChallenge(businessId, { expiresInSeconds: -1 });

      expect(await repository.markVerificationVerified(consumed)).toBeNull();
      expect(await repository.markVerificationVerified(expired)).toBeNull();
    });

    it("keeps the first verification timestamp when a correct code arrives twice", async () => {
      const businessId = await seedBusiness();
      const verificationId = await seedChallenge(businessId, {});

      const first = await repository.markVerificationVerified(verificationId);
      const second = await repository.markVerificationVerified(verificationId);

      expect(first?.verifiedAt).not.toBeNull();
      expect(second?.verifiedAt).toEqual(first?.verifiedAt);
    });
  });

  async function noopDeliver(): Promise<void> {}

  function challengeInput(
    businessId: string,
    overrides: Partial<CreateBookingPhoneVerificationInput> = {}
  ): CreateBookingPhoneVerificationInput {
    return {
      attemptsRemaining: 5,
      businessId,
      codeHash: "hashed-code",
      cooldownSeconds: 60,
      expiresAt: new Date(Date.now() + 300_000),
      id: randomUUID(),
      normalizedPhone: NORMALIZED_PHONE,
      ...overrides
    };
  }

  async function readAttemptsRemaining(verificationId: string): Promise<number> {
    const result = await databaseService.query<{ attempts_remaining: number }>(
      "SELECT attempts_remaining FROM booking_phone_verifications WHERE id = $1",
      [verificationId]
    );

    return result.rows[0].attempts_remaining;
  }

  async function countChallenges(businessId: string): Promise<number> {
    const result = await databaseService.query<{ count: string }>(
      "SELECT count(*) AS count FROM booking_phone_verifications WHERE business_id = $1",
      [businessId]
    );

    return Number(result.rows[0].count);
  }

  async function seedChallenge(
    businessId: string,
    options: {
      attemptsRemaining?: number;
      consumed?: boolean;
      expiresInSeconds?: number;
      verified?: boolean;
    }
  ): Promise<string> {
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
          verified_at,
          consumed_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'hashed-code',
          now() + make_interval(secs => $4::int),
          $5,
          CASE WHEN $6::boolean THEN now() ELSE NULL END,
          CASE WHEN $7::boolean THEN now() ELSE NULL END
        )
      `,
      [
        verificationId,
        businessId,
        NORMALIZED_PHONE,
        options.expiresInSeconds ?? 300,
        options.attemptsRemaining ?? 5,
        options.verified ?? false,
        options.consumed ?? false
      ]
    );

    return verificationId;
  }

  async function seedBusiness(): Promise<string> {
    const userId = randomUUID();
    const businessId = randomUUID();

    await databaseService.query(
      "INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, 'not-used', 'ACTIVE')",
      [userId, `verification-race-${userId}@example.com`]
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

    return businessId;
  }
});
