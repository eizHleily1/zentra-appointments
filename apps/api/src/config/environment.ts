export type AppEnvironment = "development" | "test" | "production";

export interface AppConfig {
  AUTH_LOGIN_RATE_LIMIT_MAX: number;
  AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS: number;
  AUTH_REFRESH_RATE_LIMIT_MAX: number;
  AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS: number;
  AUTH_REGISTER_RATE_LIMIT_MAX: number;
  AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS: number;
  DATABASE_URL: string;
  JWT_ACCESS_TOKEN_EXPIRES_IN: string;
  JWT_ACCESS_TOKEN_SECRET: string;
  NODE_ENV: AppEnvironment;
  PASSWORD_MIN_LENGTH: number;
  REFRESH_TOKEN_EXPIRES_IN: string;
  PORT: number;
}

const allowedEnvironments: AppEnvironment[] = ["development", "test", "production"];

export function validateEnvironment(config: Record<string, unknown>): AppConfig {
  const nodeEnv = String(config.NODE_ENV ?? "development");
  const port = Number(config.PORT ?? 3001);
  const databaseUrl = String(config.DATABASE_URL ?? "");
  const jwtAccessTokenSecret = String(config.JWT_ACCESS_TOKEN_SECRET ?? "");
  const jwtAccessTokenExpiresIn = String(config.JWT_ACCESS_TOKEN_EXPIRES_IN ?? "15m");
  const refreshTokenExpiresIn = String(config.REFRESH_TOKEN_EXPIRES_IN ?? "7d");
  const passwordMinLength = Number(config.PASSWORD_MIN_LENGTH ?? 12);
  const authRegisterRateLimitMax = Number(config.AUTH_REGISTER_RATE_LIMIT_MAX ?? 5);
  const authRegisterRateLimitTtlSeconds = Number(config.AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS ?? 60);
  const authLoginRateLimitMax = Number(config.AUTH_LOGIN_RATE_LIMIT_MAX ?? 10);
  const authLoginRateLimitTtlSeconds = Number(config.AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS ?? 60);
  const authRefreshRateLimitMax = Number(config.AUTH_REFRESH_RATE_LIMIT_MAX ?? 20);
  const authRefreshRateLimitTtlSeconds = Number(config.AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS ?? 60);

  if (!allowedEnvironments.includes(nodeEnv as AppEnvironment)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  if (databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  if (jwtAccessTokenSecret.trim().length < 32) {
    throw new Error("JWT_ACCESS_TOKEN_SECRET must be at least 32 characters");
  }

  if (jwtAccessTokenExpiresIn.trim().length === 0) {
    throw new Error("JWT_ACCESS_TOKEN_EXPIRES_IN is required");
  }

  if (!isDuration(jwtAccessTokenExpiresIn)) {
    throw new Error("JWT_ACCESS_TOKEN_EXPIRES_IN must use s, m, h, or d suffix");
  }

  if (refreshTokenExpiresIn.trim().length === 0) {
    throw new Error("REFRESH_TOKEN_EXPIRES_IN is required");
  }

  if (!isDuration(refreshTokenExpiresIn)) {
    throw new Error("REFRESH_TOKEN_EXPIRES_IN must use s, m, h, or d suffix");
  }

  if (!Number.isInteger(passwordMinLength) || passwordMinLength < 8) {
    throw new Error("PASSWORD_MIN_LENGTH must be an integer greater than or equal to 8");
  }

  assertPositiveInteger(authRegisterRateLimitMax, "AUTH_REGISTER_RATE_LIMIT_MAX");
  assertPositiveInteger(authRegisterRateLimitTtlSeconds, "AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS");
  assertPositiveInteger(authLoginRateLimitMax, "AUTH_LOGIN_RATE_LIMIT_MAX");
  assertPositiveInteger(authLoginRateLimitTtlSeconds, "AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS");
  assertPositiveInteger(authRefreshRateLimitMax, "AUTH_REFRESH_RATE_LIMIT_MAX");
  assertPositiveInteger(authRefreshRateLimitTtlSeconds, "AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS");

  return {
    AUTH_LOGIN_RATE_LIMIT_MAX: authLoginRateLimitMax,
    AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS: authLoginRateLimitTtlSeconds,
    AUTH_REFRESH_RATE_LIMIT_MAX: authRefreshRateLimitMax,
    AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS: authRefreshRateLimitTtlSeconds,
    AUTH_REGISTER_RATE_LIMIT_MAX: authRegisterRateLimitMax,
    AUTH_REGISTER_RATE_LIMIT_TTL_SECONDS: authRegisterRateLimitTtlSeconds,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_TOKEN_EXPIRES_IN: jwtAccessTokenExpiresIn,
    JWT_ACCESS_TOKEN_SECRET: jwtAccessTokenSecret,
    NODE_ENV: nodeEnv as AppEnvironment,
    PASSWORD_MIN_LENGTH: passwordMinLength,
    REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
    PORT: port
  };
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function isDuration(value: string): boolean {
  return /^\d+[smhd]$/.test(value.trim());
}
