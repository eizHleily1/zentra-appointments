import { createApiClient, type ApiAuthSession } from "./api";
import type { AuthTokens } from "./types";

const INITIAL_TOKENS: AuthTokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  tokenType: "Bearer"
};

const ROTATED_TOKENS: AuthTokens = {
  accessToken: "access-2",
  refreshToken: "refresh-2",
  tokenType: "Bearer"
};

const NEW_LOGIN_TOKENS: AuthTokens = {
  accessToken: "access-new",
  refreshToken: "refresh-new",
  tokenType: "Bearer"
};

describe("createApiClient refresh-on-401", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends the current access token and does not refresh on success", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const fetchMock = mockFetch(async ({ pathname, authorization }) => {
      expect(pathname).toBe("/businesses");
      expect(authorization).toBe("Bearer access-1");
      return jsonResponse([{ id: "biz-1" }]);
    });

    await expect(client.request("/businesses")).resolves.toEqual([{ id: "biz-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(paths(fetchMock)).toEqual(["/businesses"]);
    expect(session.rotated).toEqual([]);
    expect(session.invalidCount).toBe(0);
  });

  it("refreshes once on 401, stores both rotated tokens, and retries with the new access token", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const fetchMock = mockFetch(async ({ pathname, authorization, body }) => {
      if (pathname === "/auth/refresh") {
        expect(body).toEqual({ refreshToken: "refresh-1" });
        expect(authorization).toBeUndefined();
        return jsonResponse(ROTATED_TOKENS);
      }

      if (pathname === "/me/appointments" && authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      if (pathname === "/me/appointments" && authorization === "Bearer access-2") {
        return jsonResponse([{ id: "appt-1" }]);
      }

      return jsonResponse({ message: `unmocked ${pathname}` }, 500);
    });

    await expect(client.request("/me/appointments")).resolves.toEqual([{ id: "appt-1" }]);
    expect(paths(fetchMock)).toEqual(["/me/appointments", "/auth/refresh", "/me/appointments"]);
    expect(session.tokens).toEqual(ROTATED_TOKENS);
    expect(session.rotated).toEqual([ROTATED_TOKENS]);
    expect(session.invalidCount).toBe(0);
  });

  it("shares one in-flight refresh across concurrent 401s and retries all with the new access token", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;
    const retryAuthorizations: Array<string | undefined> = [];

    mockFetch(async ({ pathname, authorization }) => {
      if (pathname === "/auth/refresh") {
        refreshCalls += 1;
        await refreshGate;
        return jsonResponse(ROTATED_TOKENS);
      }

      if (authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      retryAuthorizations.push(authorization);
      return jsonResponse({ path: pathname });
    });

    const first = client.request("/businesses");
    const second = client.request("/me/appointments");

    await waitFor(() => refreshCalls === 1);
    expect(refreshCalls).toBe(1);
    releaseRefresh?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { path: "/businesses" },
      { path: "/me/appointments" }
    ]);
    expect(refreshCalls).toBe(1);
    expect(retryAuthorizations).toEqual(["Bearer access-2", "Bearer access-2"]);
    expect(session.tokens).toEqual(ROTATED_TOKENS);
  });

  it("clears the session when refresh fails and does not retry the original request", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const fetchMock = mockFetch(async ({ pathname, authorization }) => {
      if (pathname === "/auth/refresh") {
        return jsonResponse({ message: "Invalid refresh token" }, 401);
      }

      if (authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      return jsonResponse({ message: "should not retry" }, 200);
    });

    await expect(client.request("/businesses")).rejects.toThrow("Invalid refresh token");
    expect(paths(fetchMock)).toEqual(["/businesses", "/auth/refresh"]);
    expect(session.tokens).toBeNull();
    expect(session.invalidCount).toBe(1);
  });

  it("does not refresh again when the retry also returns 401", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const fetchMock = mockFetch(async ({ pathname }) => {
      if (pathname === "/auth/refresh") {
        return jsonResponse(ROTATED_TOKENS);
      }

      return jsonResponse({ message: "Unauthorized" }, 401);
    });

    await expect(client.request("/businesses")).rejects.toThrow("Unauthorized");
    expect(paths(fetchMock)).toEqual(["/businesses", "/auth/refresh", "/businesses"]);
    expect(session.tokens).toEqual(ROTATED_TOKENS);
    expect(session.invalidCount).toBe(0);
  });

  it("does not recursively refresh when /auth/refresh itself returns 401", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const fetchMock = mockFetch(async ({ pathname }) => {
      if (pathname === "/auth/refresh") {
        return jsonResponse({ message: "Invalid refresh token" }, 401);
      }

      return jsonResponse({ message: "Unauthorized" }, 401);
    });

    await expect(client.request("/auth/refresh")).rejects.toThrow("Invalid refresh token");
    expect(paths(fetchMock)).toEqual(["/auth/refresh"]);
    expect(session.invalidCount).toBe(0);
    expect(session.tokens).toEqual(INITIAL_TOKENS);
  });

  it("posts the refresh token to /auth/logout and clears local session first", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const fetchMock = mockFetch(async ({ pathname, body }) => {
      expect(session.tokens).toBeNull();
      expect(pathname).toBe("/auth/logout");
      expect(body).toEqual({ refreshToken: "refresh-1" });
      return jsonResponse({ success: true });
    });

    await client.logout();
    expect(paths(fetchMock)).toEqual(["/auth/logout"]);
    expect(session.tokens).toBeNull();
    expect(session.invalidCount).toBe(1);
  });

  it("clears local session even when /auth/logout fails", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    mockFetch(async () => jsonResponse({ message: "Server error" }, 500));

    await expect(client.logout()).resolves.toBeUndefined();
    expect(session.tokens).toBeNull();
    expect(session.invalidCount).toBe(1);
  });

  it("fails every waiting request when the shared refresh fails", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    let refreshCalls = 0;

    mockFetch(async ({ pathname }) => {
      if (pathname === "/auth/refresh") {
        refreshCalls += 1;
        return jsonResponse({ message: "Invalid refresh token" }, 401);
      }

      return jsonResponse({ message: "Unauthorized" }, 401);
    });

    const first = client.request("/businesses");
    const second = client.request("/me/appointments");

    await expect(first).rejects.toThrow("Invalid refresh token");
    await expect(second).rejects.toThrow("Invalid refresh token");
    expect(refreshCalls).toBe(1);
    expect(session.tokens).toBeNull();
    expect(session.invalidCount).toBe(1);
  });

  it("does not restore the session when logout happens while refresh is in flight", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const { releaseRefresh, waitForRefresh } = gatedRefreshSuccess();
    const fetchMock = mockFetch(async ({ pathname, authorization, body }) => {
      if (pathname === "/auth/refresh") {
        return waitForRefresh();
      }

      if (pathname === "/auth/logout") {
        return jsonResponse({ success: true });
      }

      if (authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      return jsonResponse({ message: "unexpected retry", path: pathname, authorization, body }, 200);
    });

    const pending = client.request("/businesses");
    await waitUntilRefreshStarted(fetchMock);
    await client.logout();
    expect(session.tokens).toBeNull();
    releaseRefresh();

    await expect(pending).rejects.toThrow("Request failed");
    expect(session.tokens).toBeNull();
    expect(session.rotated).toEqual([]);
    expect(paths(fetchMock)).toEqual(["/businesses", "/auth/refresh", "/auth/logout", "/auth/logout"]);
    expect(logoutBodies(fetchMock)).toEqual([{ refreshToken: "refresh-1" }, { refreshToken: "refresh-2" }]);
  });

  it("revokes the successor token from a stale successful refresh and does not retry waiters", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const { releaseRefresh, waitForRefresh } = gatedRefreshSuccess();
    const fetchMock = mockFetch(async ({ pathname, authorization }) => {
      if (pathname === "/auth/refresh") {
        return waitForRefresh();
      }

      if (pathname === "/auth/logout") {
        return jsonResponse({ success: true });
      }

      if (authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      return jsonResponse({ path: pathname });
    });

    const first = client.request("/businesses");
    const second = client.request("/me/appointments");
    await waitFor(() => {
      const requested = paths(fetchMock);
      return (
        requested.includes("/auth/refresh") &&
        requested.includes("/businesses") &&
        requested.includes("/me/appointments")
      );
    });
    await Promise.resolve();
    await client.logout();
    releaseRefresh();

    await expect(first).rejects.toThrow("Request failed");
    await expect(second).rejects.toThrow("Request failed");
    expect(paths(fetchMock).filter((path) => path === "/businesses")).toHaveLength(1);
    expect(paths(fetchMock).filter((path) => path === "/me/appointments")).toHaveLength(1);
    expect(paths(fetchMock).filter((path) => path === "/auth/refresh")).toHaveLength(1);
    expect(logoutBodies(fetchMock)).toEqual([{ refreshToken: "refresh-1" }, { refreshToken: "refresh-2" }]);
    expect(session.rotated).toEqual([]);
    expect(session.tokens).toBeNull();
  });

  it("does not let a stale successful refresh overwrite a newer login", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    const { releaseRefresh, waitForRefresh } = gatedRefreshSuccess();
    const fetchMock = mockFetch(async ({ pathname, authorization }) => {
      if (pathname === "/auth/refresh") {
        return waitForRefresh();
      }

      if (pathname === "/auth/logout") {
        return jsonResponse({ success: true });
      }

      if (authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      return jsonResponse({ path: pathname });
    });

    const pending = client.request("/businesses");
    await waitUntilRefreshStarted(fetchMock);
    await client.logout();
    session.installTokens(NEW_LOGIN_TOKENS);
    releaseRefresh();

    await expect(pending).rejects.toThrow("Request failed");
    expect(session.tokens).toEqual(NEW_LOGIN_TOKENS);
    expect(session.rotated).toEqual([]);
    expect(logoutBodies(fetchMock)).toEqual([{ refreshToken: "refresh-1" }, { refreshToken: "refresh-2" }]);
  });

  it("does not let a stale failed refresh clear a newer login", async () => {
    const session = createSession(INITIAL_TOKENS);
    const client = createApiClient(session);
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const fetchMock = mockFetch(async ({ pathname, authorization }) => {
      if (pathname === "/auth/refresh") {
        await refreshGate;
        return jsonResponse({ message: "Invalid refresh token" }, 401);
      }

      if (pathname === "/auth/logout") {
        return jsonResponse({ success: true });
      }

      if (authorization === "Bearer access-1") {
        return jsonResponse({ message: "Unauthorized" }, 401);
      }

      return jsonResponse({ path: pathname });
    });

    const pending = client.request("/businesses");
    await waitUntilRefreshStarted(fetchMock);
    await client.logout();
    session.installTokens(NEW_LOGIN_TOKENS);
    const invalidCountAfterLogin = session.invalidCount;
    releaseRefresh?.();

    await expect(pending).rejects.toThrow("Invalid refresh token");
    expect(session.tokens).toEqual(NEW_LOGIN_TOKENS);
    expect(session.invalidCount).toBe(invalidCountAfterLogin);
    expect(logoutBodies(fetchMock)).toEqual([{ refreshToken: "refresh-1" }]);
  });
});

function createSession(initial: AuthTokens | null) {
  let tokens = initial;
  const rotated: AuthTokens[] = [];
  let invalidCount = 0;
  const session: ApiAuthSession = {
    getTokens: () => tokens,
    onSessionInvalid: () => {
      tokens = null;
      invalidCount += 1;
    },
    onTokensRotated: (nextTokens) => {
      tokens = nextTokens;
      rotated.push(nextTokens);
    }
  };

  return {
    get invalidCount() {
      return invalidCount;
    },
    get tokens() {
      return tokens;
    },
    installTokens(nextTokens: AuthTokens) {
      tokens = nextTokens;
    },
    rotated,
    ...session
  };
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data)
  };
}

function mockFetch(
  handler: (request: {
    authorization: string | undefined;
    body: unknown;
    pathname: string;
  }) => Promise<ReturnType<typeof jsonResponse>>
) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(url, "http://localhost:3001").pathname;
    const bodyText = typeof init?.body === "string" ? init.body : null;

    return handler({
      authorization: readAuthorization(init?.headers),
      body: bodyText ? JSON.parse(bodyText) : null,
      pathname
    });
  });

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function readAuthorization(headers: HeadersInit | undefined): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get("authorization") ?? undefined;
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([name]) => name.toLowerCase() === "authorization");
    return match?.[1];
  }

  const record = headers as Record<string, string>;
  return record.authorization ?? record.Authorization;
}

function paths(fetchMock: jest.Mock): string[] {
  return fetchMock.mock.calls.map(([input]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return new URL(url, "http://localhost:3001").pathname;
  });
}

function logoutBodies(fetchMock: jest.Mock): unknown[] {
  return fetchMock.mock.calls.flatMap(([input, init]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (new URL(url, "http://localhost:3001").pathname !== "/auth/logout") {
      return [];
    }

    return [typeof init?.body === "string" ? JSON.parse(init.body) : null];
  });
}

function gatedRefreshSuccess() {
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  return {
    releaseRefresh() {
      releaseRefresh?.();
    },
    async waitForRefresh() {
      await refreshGate;
      return jsonResponse(ROTATED_TOKENS);
    }
  };
}

async function waitUntilRefreshStarted(fetchMock: jest.Mock): Promise<void> {
  await waitFor(() => paths(fetchMock).includes("/auth/refresh"));
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("Timed out waiting for condition");
}
