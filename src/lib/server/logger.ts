/* eslint-disable no-console */

import { captureServerException } from "@/lib/server/observability";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function hasContext(context: Record<string, unknown> | undefined) {
  return context && Object.keys(context).length > 0;
}

export function logError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const contextPayload = hasContext(context) ? context : undefined;
  captureServerException(scope, error, contextPayload).catch(() => {
    // Ignore Sentry transport failures and preserve primary log flow.
  });

  if (error instanceof Error) {
    if (contextPayload) {
      console.error(`[${scope}]`, contextPayload, error);
      return;
    }

    console.error(`[${scope}]`, error);
    return;
  }

  if (contextPayload) {
    console.error(`[${scope}]`, contextPayload, toErrorMessage(error));
    return;
  }

  console.error(`[${scope}]`, toErrorMessage(error));
}

export function logInfo(scope: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (context && Object.keys(context).length > 0) {
    console.info(`[${scope}]`, context);
    return;
  }

  console.info(`[${scope}]`);
}
