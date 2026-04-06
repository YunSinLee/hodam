import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = {
  init: vi.fn(),
  withScope: vi.fn(
    (
      callback: (scope: {
        setTag: (name: string, value: string) => void;
        setContext: (name: string, context: Record<string, unknown>) => void;
      }) => void,
    ) => {
      callback({
        setTag: sentryMockScope.setTag,
        setContext: sentryMockScope.setContext,
      });
    },
  ),
  captureException: vi.fn(),
};

const sentryMockScope = {
  setTag: vi.fn(),
  setContext: vi.fn(),
};

vi.mock("@sentry/nextjs", () => sentryMock);

describe("observability", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_ENVIRONMENT;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
  });

  it("does not initialize sentry when DSN is missing", async () => {
    const { captureServerException } = await import("./observability");

    await captureServerException("/api/test", new Error("boom"), {
      requestId: "req-missing-dsn",
    });

    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it("captures exception with request-id context when DSN is configured", async () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    process.env.SENTRY_ENVIRONMENT = "staging";
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0.25";

    const { captureServerException } = await import("./observability");
    const error = new Error("boom");

    await captureServerException("/api/v1/threads", error, {
      requestId: "req-1",
      userId: "user-1",
    });

    expect(sentryMock.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: process.env.SENTRY_DSN,
        environment: "staging",
        tracesSampleRate: 0.25,
      }),
    );
    expect(sentryMockScope.setTag).toHaveBeenCalledWith(
      "hodam.scope",
      "/api/v1/threads",
    );
    expect(sentryMockScope.setTag).toHaveBeenCalledWith(
      "hodam.request_id",
      "req-1",
    );
    expect(sentryMockScope.setContext).toHaveBeenCalledWith("hodam", {
      requestId: "req-1",
      userId: "user-1",
    });
    expect(sentryMock.captureException).toHaveBeenCalledWith(error);
  });
});
