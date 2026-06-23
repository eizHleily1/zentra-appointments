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
      JWT_ACCESS_TOKEN_EXPIRES_IN: "15m",
      JWT_ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-chars",
      NODE_ENV: "test",
      PASSWORD_MIN_LENGTH: 12,
      REFRESH_TOKEN_EXPIRES_IN: "7d",
      PORT: 3001
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
