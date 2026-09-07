import { Platform } from "react-native";
import type { AuthTokens } from "./types";

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

export function getApiBaseUrl(): string {
  if (Platform.OS === "web") {
    return "/api";
  }

  return process.env?.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
}

const API_URL = getApiBaseUrl();

/** Mirrors BOOKING_VERIFICATION_INVALID_CODE on the API. */
const BOOKING_VERIFICATION_INVALID_CODE = "booking_verification_invalid";

/**
 * Carries the HTTP status and the API's machine-readable error code, so callers can tell
 * a retryable failure from a rejected input without matching on message text.
 */
export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function apiErrorStatus(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}

/**
 * True only when the API says the verification challenge itself is unusable. Booking also
 * returns 400 for unrelated reasons, and those must not discard a valid challenge.
 */
export function isInvalidVerificationError(error: unknown): boolean {
  return error instanceof ApiError && error.code === BOOKING_VERIFICATION_INVALID_CODE;
}

export interface ApiAuthSession {
  getTokens: () => AuthTokens | null;
  onSessionInvalid: () => void;
  onTokensRotated: (tokens: AuthTokens) => void;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const { data, response } = await executeRequest(path, options, accessToken ?? null);

  if (!response.ok) {
    throw new ApiError(errorMessage(data), response.status, errorCode(data));
  }

  return data as T;
}

export function createApiClient(session: ApiAuthSession) {
  let refreshInFlight: Promise<AuthTokens> | null = null;

  async function refreshSession(): Promise<AuthTokens> {
    if (!refreshInFlight) {
      refreshInFlight = rotateRefreshToken().finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  async function rotateRefreshToken(): Promise<AuthTokens> {
    const presentedRefreshToken = session.getTokens()?.refreshToken;

    if (!presentedRefreshToken) {
      throw new Error("Request failed");
    }

    let rotated: AuthTokens;

    try {
      rotated = await apiFetch<AuthTokens>("/auth/refresh", {
        body: JSON.stringify({ refreshToken: presentedRefreshToken }),
        method: "POST"
      });
    } catch (error) {
      if (session.getTokens()?.refreshToken === presentedRefreshToken) {
        session.onSessionInvalid();
      }

      throw error;
    }

    if (session.getTokens()?.refreshToken !== presentedRefreshToken) {
      await logoutRefreshToken(rotated.refreshToken);
      throw new Error("Request failed");
    }

    session.onTokensRotated(rotated);
    return rotated;
  }

  async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
    const accessToken = session.getTokens()?.accessToken ?? null;
    const { data, response } = await executeRequest(path, options, accessToken);

    if (response.status === 401 && allowRefresh && shouldAttemptRefresh(path, session.getTokens())) {
      await refreshSession();
      return request<T>(path, options, false);
    }

    if (!response.ok) {
      throw new ApiError(errorMessage(data), response.status, errorCode(data));
    }

    return data as T;
  }

  async function logout(): Promise<void> {
    const refreshToken = session.getTokens()?.refreshToken ?? null;
    session.onSessionInvalid();

    if (!refreshToken) {
      return;
    }

    await logoutRefreshToken(refreshToken);
  }

  return { logout, request };
}

function shouldAttemptRefresh(path: string, tokens: AuthTokens | null): boolean {
  return Boolean(tokens?.refreshToken) && path !== "/auth/refresh" && path !== "/auth/logout";
}

async function logoutRefreshToken(refreshToken: string): Promise<void> {
  try {
    await apiFetch("/auth/logout", {
      body: JSON.stringify({ refreshToken }),
      method: "POST"
    });
  } catch {
    // Local logout already happened; server revocation is best-effort.
  }
}

async function executeRequest(
  path: string,
  options: RequestInit,
  accessToken: string | null
): Promise<{ data: unknown; response: Response }> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    }
  });
  const text = await response.text();
  const data = text.length > 0 ? JSON.parse(text) : null;

  return { data, response };
}

function errorCode(data: unknown): string | null {
  if (data && typeof data === "object" && "code" in data) {
    const code = (data as { code?: unknown }).code;

    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }

  return null;
}

function errorMessage(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.join(", ");
    }

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Request failed";
}
