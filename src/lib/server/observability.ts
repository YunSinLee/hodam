import { getOptionalEnv } from "@/lib/env";

type ErrorContext = Record<string, unknown> | undefined;

let sentryModulePromise: Promise<
  typeof import("@sentry/nextjs") | null
> | null = null;

function normalizeSampleRate(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

function getSentryDsn() {
  return getOptionalEnv("SENTRY_DSN");
}

async function loadSentry() {
  if (sentryModulePromise) return sentryModulePromise;

  sentryModulePromise = (async () => {
    const dsn = getSentryDsn();
    if (!dsn) return null;

    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.init({
        dsn,
        enabled: true,
        environment:
          getOptionalEnv("SENTRY_ENVIRONMENT") || process.env.NODE_ENV,
        tracesSampleRate: normalizeSampleRate(
          getOptionalEnv("SENTRY_TRACES_SAMPLE_RATE"),
          0.1,
        ),
      });

      return Sentry;
    } catch {
      return null;
    }
  })();

  return sentryModulePromise;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

export async function captureServerException(
  scope: string,
  error: unknown,
  context?: ErrorContext,
) {
  const sentry = await loadSentry();
  if (!sentry) return;

  sentry.withScope(sentryScope => {
    sentryScope.setTag("hodam.scope", scope);

    if (context && Object.keys(context).length > 0) {
      const { requestId } = context;
      if (typeof requestId === "string" && requestId.trim().length > 0) {
        sentryScope.setTag("hodam.request_id", requestId.trim());
      }
      sentryScope.setContext("hodam", context);
    }

    sentry.captureException(toError(error));
  });
}
