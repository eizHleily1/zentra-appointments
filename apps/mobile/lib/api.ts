import { Platform } from "react-native";

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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new Error(message ?? "Request failed");
  }

  return data as T;
}

export function createApiClient(accessToken?: string | null) {
  return {
    request: <T,>(path: string, options: RequestInit = {}) => apiFetch<T>(path, options, accessToken ?? null)
  };
}
