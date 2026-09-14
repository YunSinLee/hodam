import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendFetchedAuthCallbackMetrics,
  createAuthCallbackMetricEmitter,
  fetchAuthCallbackRecentMetrics,
} from "@/app/auth/callback/auth-callback-metrics";

describe("auth-callback-metrics", () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          pathname: "/auth/callback",
        },
      },
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
    });
  });

  it("posts metric payload to diagnostics endpoint", () => {
    const emitMetric = createAuthCallbackMetricEmitter(
      new URL("http://localhost:3000/auth/callback"),
    );

    emitMetric("exchange_start", {
      hasCode: true,
      ignored: {
        nested: true,
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const requestInit = fetchCall?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit?.body || "{}"));
    expect(payload.stage).toBe("exchange_start");
    expect(payload.callbackPath).toBe("/auth/callback");
    expect(payload.details).toEqual({
      hasCode: true,
    });
  });

  it("buffers debug metrics when auth_debug=1 query is present", () => {
    const emitMetric = createAuthCallbackMetricEmitter(
      new URL("http://localhost:3000/auth/callback?auth_debug=1"),
    );
    emitMetric("flow_start");

    const debugBuffer = (globalThis.window as Window)
      .__HODAM_AUTH_CALLBACK_METRICS__;
    expect(Array.isArray(debugBuffer)).toBe(true);
    expect(debugBuffer?.at(-1)?.stage).toBe("flow_start");
  });

  it("fetches recent callback metrics by attempt id", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        attemptId: "attempt-123",
        events: [
          {
            stage: "flow_start",
            callbackPath: "/auth/callback",
            timestampMs: 1712419201000,
            details: {
              provider: "google",
            },
          },
        ],
        truncated: false,
        degraded: false,
        degradedReason: null,
      }),
    } as never);

    const result = await fetchAuthCallbackRecentMetrics("attempt-123");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/callback/metrics/recent?attemptId=attempt-123&limit=20",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(result).toEqual({
      attemptId: "attempt-123",
      events: [
        {
          stage: "flow_start",
          callbackPath: "/auth/callback",
          timestampMs: 1712419201000,
          details: {
            provider: "google",
          },
        },
      ],
      truncated: false,
      degraded: false,
      degradedReason: null,
    });
  });

  it("merges fetched callback metrics into browser debug buffer", () => {
    const emitMetric = createAuthCallbackMetricEmitter(
      new URL("http://localhost:3000/auth/callback?auth_debug=1"),
    );
    emitMetric("flow_start", {
      provider: "kakao",
    });

    appendFetchedAuthCallbackMetrics([
      {
        stage: "callback_success",
        callbackPath: "/auth/callback",
        timestampMs: 1712419204000,
        details: {
          provider: "kakao",
        },
      },
    ]);

    const debugBuffer = (globalThis.window as Window)
      .__HODAM_AUTH_CALLBACK_METRICS__;
    expect(debugBuffer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "flow_start",
        }),
        expect.objectContaining({
          stage: "callback_success",
        }),
      ]),
    );
    expect(debugBuffer).toHaveLength(2);
  });
});
