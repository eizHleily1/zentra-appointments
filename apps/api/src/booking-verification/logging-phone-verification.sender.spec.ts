import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/environment";
import { LoggingPhoneVerificationSender } from "./logging-phone-verification.sender";

function configService(values: Partial<AppConfig>): ConfigService<AppConfig, true> {
  return {
    get: (key: keyof AppConfig) => values[key]
  } as unknown as ConfigService<AppConfig, true>;
}

/**
 * This sender is the only runtime guard against OTP leakage on non-production hosts, so a
 * silent regression to "print the code unless production" has to fail a test.
 */
describe("LoggingPhoneVerificationSender", () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, "log").mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("never logs the plaintext code when the opt-in is off", async () => {
    const sender = new LoggingPhoneVerificationSender(
      configService({ PHONE_VERIFICATION_LOG_CODES: false, PHONE_VERIFICATION_PROVIDER: "log" })
    );

    await sender.sendVerificationCode({
      businessId: "business-1",
      code: "123456",
      phoneNumber: "+1 (555) 123-4567"
    });

    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain("123456");
  });

  it("masks all but the last four digits of the phone number when the opt-in is off", async () => {
    const sender = new LoggingPhoneVerificationSender(
      configService({ PHONE_VERIFICATION_LOG_CODES: false, PHONE_VERIFICATION_PROVIDER: "log" })
    );

    await sender.sendVerificationCode({
      businessId: "business-1",
      code: "123456",
      phoneNumber: "+1 (555) 123-4567"
    });

    expect(logged[0]).toContain("****4567");
    expect(logged[0]).not.toContain("5551234567");
    expect(logged[0]).not.toContain("555) 123-4567");
  });

  it("masks a short phone number entirely", async () => {
    const sender = new LoggingPhoneVerificationSender(
      configService({ PHONE_VERIFICATION_LOG_CODES: false, PHONE_VERIFICATION_PROVIDER: "log" })
    );

    await sender.sendVerificationCode({ businessId: "business-1", code: "123456", phoneNumber: "4567" });

    expect(logged[0]).toContain("****");
    expect(logged[0]).not.toContain("****4567");
  });

  it("logs the plaintext code only when the opt-in is explicitly enabled", async () => {
    const sender = new LoggingPhoneVerificationSender(
      configService({ PHONE_VERIFICATION_LOG_CODES: true, PHONE_VERIFICATION_PROVIDER: "log" })
    );

    await sender.sendVerificationCode({
      businessId: "business-1",
      code: "123456",
      phoneNumber: "+1 (555) 123-4567"
    });

    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("123456");
    expect(logged[0]).toContain("+1 (555) 123-4567");
  });

  // NODE_ENV alone must never unlock code logging: staging, preview, and CI all run with a
  // non-production NODE_ENV and would otherwise log usable codes.
  it.each(["development", "test", "staging", "preview"])(
    "stays quiet about the code in %s when the opt-in is off",
    async (nodeEnv) => {
      const sender = new LoggingPhoneVerificationSender(
        configService({
          NODE_ENV: nodeEnv as AppConfig["NODE_ENV"],
          PHONE_VERIFICATION_LOG_CODES: false,
          PHONE_VERIFICATION_PROVIDER: "log"
        })
      );

      await sender.sendVerificationCode({
        businessId: "business-1",
        code: "123456",
        phoneNumber: "+1 (555) 123-4567"
      });

      expect(logged[0]).not.toContain("123456");
    }
  );
});
