import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { FakePhoneVerificationSender } from "../../test/fake-phone-verification.sender";
import { InMemoryBookingVerificationRepository } from "../../test/in-memory-booking-verification.repository";
import { PasswordService } from "../auth/password.service";
import type { Business, BusinessRepository } from "../businesses/business.repository";
import type { AppConfig } from "../config/environment";
import { BookingVerificationService } from "./booking-verification.service";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";

function businessRepository(business: Business | null): BusinessRepository {
  return {
    findActiveBusinessById: jest.fn().mockResolvedValue(business)
  } as unknown as BusinessRepository;
}

function configService(overrides: Partial<AppConfig> = {}): ConfigService<AppConfig, true> {
  const values: Partial<AppConfig> = {
    GUEST_BOOKING_VERIFICATION_CODE_TTL_SECONDS: 300,
    GUEST_BOOKING_VERIFICATION_MAX_ATTEMPTS: 5,
    GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS: 0,
    ...overrides
  };

  return {
    get: (key: keyof AppConfig) => values[key]
  } as unknown as ConfigService<AppConfig, true>;
}

describe("BookingVerificationService", () => {
  const activeBusiness = { id: BUSINESS_ID, name: "Downtown Barber" } as Business;
  let repository: InMemoryBookingVerificationRepository;
  let sender: FakePhoneVerificationSender;

  function createService(overrides: Partial<AppConfig> = {}): BookingVerificationService {
    return new BookingVerificationService(
      repository,
      businessRepository(activeBusiness),
      sender,
      new PasswordService(),
      configService(overrides)
    );
  }

  beforeEach(() => {
    repository = new InMemoryBookingVerificationRepository();
    sender = new FakePhoneVerificationSender();
  });

  it("creates a challenge with a hashed code and never returns the code", async () => {
    const service = createService();

    const challenge = await service.requestVerification({
      businessId: BUSINESS_ID,
      phoneNumber: "555-123-4567"
    });

    expect(challenge.verificationId).toBeDefined();
    expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(challenge)).not.toContain(sender.lastCodeFor("555-123-4567"));

    const [stored] = repository.getVerifications();
    expect(stored.normalizedPhone).toBe("5551234567");
    expect(stored.codeHash).not.toContain(sender.lastCodeFor("555-123-4567"));
    expect(stored.codeHash.startsWith("scrypt$")).toBe(true);
    expect(stored.verifiedAt).toBeNull();
  });

  it("sends a six digit code through the pluggable sender without any SMS vendor", async () => {
    const service = createService();

    await service.requestVerification({ businessId: BUSINESS_ID, phoneNumber: "555-123-4567" });

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].businessId).toBe(BUSINESS_ID);
    expect(sender.lastCodeFor("555-123-4567")).toMatch(/^\d{6}$/);
  });

  it("rejects an unknown business", async () => {
    const service = new BookingVerificationService(
      repository,
      businessRepository(null),
      sender,
      new PasswordService(),
      configService()
    );

    await expect(
      service.requestVerification({ businessId: BUSINESS_ID, phoneNumber: "555-123-4567" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a phone number with no digits", async () => {
    const service = createService();

    await expect(
      service.requestVerification({ businessId: BUSINESS_ID, phoneNumber: "not-a-phone" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("verifies a correct code", async () => {
    const service = createService();
    const challenge = await service.requestVerification({
      businessId: BUSINESS_ID,
      phoneNumber: "555-123-4567"
    });

    const result = await service.verifyCode({
      businessId: BUSINESS_ID,
      code: sender.lastCodeFor("555-123-4567"),
      verificationId: challenge.verificationId
    });

    expect(result.verified).toBe(true);
    expect(repository.getVerifications()[0].verifiedAt).not.toBeNull();
  });

  it("rejects an incorrect code and spends an attempt", async () => {
    const service = createService();
    const challenge = await service.requestVerification({
      businessId: BUSINESS_ID,
      phoneNumber: "555-123-4567"
    });

    await expect(
      service.verifyCode({
        businessId: BUSINESS_ID,
        code: nextCode(sender.lastCodeFor("555-123-4567")),
        verificationId: challenge.verificationId
      })
    ).rejects.toThrow("Verification code is invalid or expired");

    expect(repository.getVerifications()[0].attemptsRemaining).toBe(4);
    expect(repository.getVerifications()[0].verifiedAt).toBeNull();
  });

  it("locks the challenge after the attempt limit is spent", async () => {
    const service = createService({ GUEST_BOOKING_VERIFICATION_MAX_ATTEMPTS: 2 });
    const challenge = await service.requestVerification({
      businessId: BUSINESS_ID,
      phoneNumber: "555-123-4567"
    });
    const wrongCode = nextCode(sender.lastCodeFor("555-123-4567"));

    await expect(
      service.verifyCode({ businessId: BUSINESS_ID, code: wrongCode, verificationId: challenge.verificationId })
    ).rejects.toThrow("Verification code is invalid or expired");
    await expect(
      service.verifyCode({ businessId: BUSINESS_ID, code: wrongCode, verificationId: challenge.verificationId })
    ).rejects.toThrow("Too many incorrect codes. Request a new code.");

    // The correct code no longer works once the attempts are exhausted.
    await expect(
      service.verifyCode({
        businessId: BUSINESS_ID,
        code: sender.lastCodeFor("555-123-4567"),
        verificationId: challenge.verificationId
      })
    ).rejects.toThrow("Too many incorrect codes. Request a new code.");
  });

  it("rejects an expired code", async () => {
    const service = createService();
    const challenge = await service.requestVerification({
      businessId: BUSINESS_ID,
      phoneNumber: "555-123-4567"
    });
    repository.expireVerification(challenge.verificationId);

    await expect(
      service.verifyCode({
        businessId: BUSINESS_ID,
        code: sender.lastCodeFor("555-123-4567"),
        verificationId: challenge.verificationId
      })
    ).rejects.toThrow("Verification code expired");
  });

  it("does not reveal that a challenge exists for another business", async () => {
    const service = createService();
    const challenge = await service.requestVerification({
      businessId: BUSINESS_ID,
      phoneNumber: "555-123-4567"
    });

    await expect(
      service.verifyCode({
        businessId: "22222222-2222-4222-8222-222222222222",
        code: sender.lastCodeFor("555-123-4567"),
        verificationId: challenge.verificationId
      })
    ).rejects.toThrow("Verification code is invalid or expired");

    await expect(
      service.verifyCode({
        businessId: BUSINESS_ID,
        code: sender.lastCodeFor("555-123-4567"),
        verificationId: randomUUID()
      })
    ).rejects.toThrow("Verification code is invalid or expired");
  });

  it("throttles resends for the same business and phone", async () => {
    const service = createService({ GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS: 60 });
    await service.requestVerification({ businessId: BUSINESS_ID, phoneNumber: "555-123-4567" });

    await expect(
      service.requestVerification({ businessId: BUSINESS_ID, phoneNumber: "(555) 123 4567" })
    ).rejects.toBeInstanceOf(HttpException);

    // A different phone number on the same business is unaffected.
    await expect(
      service.requestVerification({ businessId: BUSINESS_ID, phoneNumber: "555-000-1111" })
    ).resolves.toBeDefined();
  });
});

function nextCode(code: string): string {
  return ((Number(code) + 1) % 1_000_000).toString().padStart(6, "0");
}
