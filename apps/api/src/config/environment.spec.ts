import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  it("loads required application and authentication configuration", () => {
    expect(
      validateEnvironment({
        AUTH_LOGIN_RATE_LIMIT_MAX: "10",
        AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS: "60",
        AUTH_REFRESH_RATE_LIMIT_MAX: "20",
        AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS: "60",
        AUTH_REGISTER_RATE_LIMIT_MAX: "5",
        AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS: "60",
        DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
        GUEST_BOOKING_RATE_LIMIT_MAX: "10",
        GUEST_BOOKING_RATE_LIMIT_TTL_SECONDS: "60",
        GUEST_BOOKING_VERIFICATION_CHECK_RATE_LIMIT_MAX: "10",
        GUEST_BOOKING_VERIFICATION_CHECK_RATE_LIMIT_TTL_SECONDS: "60",
        GUEST_BOOKING_VERIFICATION_CODE_TTL_SECONDS: "300",
        GUEST_BOOKING_VERIFICATION_MAX_ATTEMPTS: "5",
        GUEST_BOOKING_VERIFICATION_REQUEST_RATE_LIMIT_MAX: "5",
        GUEST_BOOKING_VERIFICATION_REQUEST_RATE_LIMIT_TTL_SECONDS: "60",
        GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS: "60",
        JWT_ACCESS_TOKEN_EXPIRES_IN: "15m",
        JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
        NODE_ENV: "test",
        PASSWORD_MIN_LENGTH: "12",
        REFRESH_TOKEN_EXPIRES_IN: "7d",
        PORT: "3001"
      })
    ).toEqual({
      AUTH_LOGIN_RATE_LIMIT_MAX: 10,
      AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS: 60,
      AUTH_REFRESH_RATE_LIMIT_MAX: 20,
      AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS: 60,
      AUTH_REGISTER_RATE_LIMIT_MAX: 5,
      AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS: 60,
      DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
      GUEST_BOOKING_RATE_LIMIT_MAX: 10,
      GUEST_BOOKING_RATE_LIMIT_TTL_SECONDS: 60,
      GUEST_BOOKING_VERIFICATION_CHECK_RATE_LIMIT_MAX: 10,
      GUEST_BOOKING_VERIFICATION_CHECK_RATE_LIMIT_TTL_SECONDS: 60,
      GUEST_BOOKING_VERIFICATION_CODE_TTL_SECONDS: 300,
      GUEST_BOOKING_VERIFICATION_MAX_ATTEMPTS: 5,
      GUEST_BOOKING_VERIFICATION_REQUEST_RATE_LIMIT_MAX: 5,
      GUEST_BOOKING_VERIFICATION_REQUEST_RATE_LIMIT_TTL_SECONDS: 60,
      GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
      JWT_ACCESS_TOKEN_EXPIRES_IN: "15m",
      JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
      NODE_ENV: "test",
      PASSWORD_MIN_LENGTH: 12,
      PHONE_VERIFICATION_LOG_CODES: false,
      PHONE_VERIFICATION_PROVIDER: "log",
      REFRESH_TOKEN_EXPIRES_IN: "7d",
      PORT: 3001
    });
  });

  describe("phone verification safety rails", () => {
    function productionConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
        JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
        NODE_ENV: "production",
        PORT: "3001",
        ...overrides
      };
    }

    it("refuses to boot production on the log provider so no challenge is issued without an SMS", () => {
      expect(() => validateEnvironment(productionConfig({ PHONE_VERIFICATION_PROVIDER: "log" }))).toThrow(
        "PHONE_VERIFICATION_PROVIDER=log cannot be used in production"
      );
    });

    it("defaults to the log provider outside production", () => {
      expect(
        validateEnvironment({
          DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
          JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
          NODE_ENV: "development",
          PORT: "3001"
        }).PHONE_VERIFICATION_PROVIDER
      ).toBe("log");
    });

    it("rejects an unknown provider", () => {
      expect(() =>
        validateEnvironment({
          DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
          JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
          NODE_ENV: "development",
          PHONE_VERIFICATION_PROVIDER: "twilio",
          PORT: "3001"
        })
      ).toThrow("PHONE_VERIFICATION_PROVIDER must be one of log");
    });

    it("refuses to boot production with plaintext code logging enabled", () => {
      expect(() => validateEnvironment(productionConfig({ PHONE_VERIFICATION_LOG_CODES: "true" }))).toThrow(
        "PHONE_VERIFICATION_LOG_CODES must be false in production"
      );
    });

    it("keeps code logging off unless it is explicitly enabled, even outside production", () => {
      for (const nodeEnv of ["development", "test"]) {
        expect(
          validateEnvironment({
            DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
            JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
            NODE_ENV: nodeEnv,
            PORT: "3001"
          }).PHONE_VERIFICATION_LOG_CODES
        ).toBe(false);
      }
    });

    it("refuses to boot production with resend throttling disabled", () => {
      expect(() =>
        validateEnvironment(productionConfig({ GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS: "0" }))
      ).toThrow("GUEST_BOOKING_VERIFICATION_RESEND_COOLDOWN_SECONDS must be greater than 0 in production");
    });
  });

  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() =>
      validateEnvironment({
        JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
        NODE_ENV: "test",
        PORT: "3001"
      })
    ).toThrow("DATABASE_URL is required");
  });

  it("fails clearly when JWT secret is missing", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://appointment_saas:appointment_saas@localhost:5433/appointment_saas_dev",
        NODE_ENV: "test",
        PORT: "3001"
      })
    ).toThrow("JWT_ACCESS_TOKEN_SECRET must be at least 32 characters");
  });
});
