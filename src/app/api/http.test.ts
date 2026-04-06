import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { getSessionMock, refreshSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));

vi.mock("@/app/utils/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      refreshSession: refreshSessionMock,
    },
  },
}));

async function loadHttpModule() {
  return import("./http");
}

function setLocalStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  const localStorageMock = {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] || null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: localStorageMock,
    },
  });
}

function setSession(accessToken: string | null, error: unknown = null) {
  getSessionMock.mockResolvedValue({
    data: {
      session: accessToken ? { access_token: accessToken } : null,
    },
    error,
  });
}

describe("authorizedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    setLocalStorage({});
    refreshSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("sends authorized request with bearer token", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authorizedFetch<{ ok: boolean }>("/api/v1/threads", {
      method: "GET",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("returns response metadata with authorizedFetchWithMeta", async () => {
    const { authorizedFetchWithMeta } = await loadHttpModule();
    setSession("token-meta");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-hodam-threads-source": "fallback",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authorizedFetchWithMeta<{ ok: boolean }>(
      "/api/v1/threads",
      { method: "GET" },
    );

    expect(result.data).toEqual({ ok: true });
    expect(result.status).toBe(200);
    expect(result.headers.get("x-hodam-threads-source")).toBe("fallback");
  });

  it("validates response payload with schema when provided", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authorizedFetch(
      "/api/v1/threads",
      { method: "GET" },
      z.object({ ok: z.boolean() }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("throws 502 when response payload does not match schema", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: "true" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizedFetch(
        "/api/v1/threads",
        {
          method: "GET",
        },
        z.object({ ok: z.boolean() }),
      ),
    ).rejects.toMatchObject({
      status: 502,
      message: "Invalid API response schema",
    });
  });

  it("retries session lookup until token is available", async () => {
    const { authorizedFetch } = await loadHttpModule();

    getSessionMock
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: "token-late" } },
        error: null,
      });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await authorizedFetch("/api/v1/threads", { method: "GET" });

    expect(getSessionMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws 401 when token is missing", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession(null);

    await expect(
      authorizedFetch("/api/v1/threads", { method: "GET" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "로그인이 필요합니다.",
    });
  });

  it("falls back to localStorage auth token when session is empty", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession(null);
    setLocalStorage({
      "sb-zdvnlojkptjgalxgcqxa-auth-token": JSON.stringify({
        currentSession: {
          access_token: "fallback.jwt.token",
        },
      }),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authorizedFetch<{ ok: boolean }>("/api/v1/threads", {
      method: "GET",
    });

    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer fallback.jwt.token");
  });

  it("supports legacy token-only localStorage auth format", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession(null);
    setLocalStorage({
      "sb-zdvnlojkptjgalxgcqxa-auth-token": JSON.stringify({
        token: "legacy.jwt.token",
      }),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await authorizedFetch<{ ok: boolean }>("/api/v1/threads", {
      method: "GET",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer legacy.jwt.token");
  });

  it("throws ApiError with server error payload", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Failed to fetch threads" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizedFetch("/api/v1/threads", { method: "GET" }),
    ).rejects.toMatchObject({
      status: 500,
      message: "Failed to fetch threads",
    });
  });

  it("throws 502 when 2xx response body is malformed JSON", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{ malformed", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizedFetch("/api/v1/threads", { method: "GET" }),
    ).rejects.toMatchObject({
      status: 502,
      message: "Invalid JSON response",
    });
  });

  it("preserves original status for malformed JSON error responses", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{ malformed", {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizedFetch("/api/v1/threads", { method: "GET" }),
    ).rejects.toMatchObject({
      status: 500,
      message: "Request failed (500)",
      details: "{ malformed",
    });
  });

  it("refreshes session and retries once after 401", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-old");
    refreshSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-new" } },
      error: null,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authorizedFetch<{ ok: boolean }>("/api/v1/threads", {
      method: "GET",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);

    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const firstHeaders = new Headers(firstInit.headers);
    expect(firstHeaders.get("Authorization")).toBe("Bearer token-old");

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondHeaders = new Headers(secondInit.headers);
    expect(secondHeaders.get("Authorization")).toBe("Bearer token-new");
  });

  it("throws 401 when refresh does not provide a new token", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");
    refreshSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-1" } },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizedFetch("/api/v1/threads", { method: "GET" }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it("does not force JSON content-type when body is FormData", async () => {
    const { authorizedFetch } = await loadHttpModule();
    setSession("token-1");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["avatar"], { type: "image/png" }),
      "avatar.png",
    );

    await authorizedFetch<{ success: boolean }>("/api/v1/profile/image", {
      method: "POST",
      body: formData,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
    expect(headers.get("Content-Type")).toBeNull();
  });
});
