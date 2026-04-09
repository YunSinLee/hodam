#!/usr/bin/env node

import { spawnSync } from "child_process";
import path from "path";
import { shouldRequireAuthFlow } from "./lib/auth-e2e-utils.mjs";

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const baseUrl = (process.env.HODAM_API_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const requireAuthorized =
  args.has("--require-authorized") ||
  shouldRequireAuthFlow({
    explicitValue: process.env.HODAM_REQUIRE_AUTHORIZED_CHECK || "",
    processEnv: process.env,
  });

function resolveOptionalAccessToken() {
  const explicit = (process.env.HODAM_TEST_ACCESS_TOKEN || "").trim();
  if (explicit) {
    return {
      token: explicit,
      source: "env",
      reason: "",
    };
  }

  const resolved = spawnSync(
    process.execPath,
    [path.join("scripts", "get-test-access-token.mjs")],
    {
      cwd,
      env: process.env,
      encoding: "utf8",
    },
  );

  if (resolved.status !== 0) {
    const detail =
      (resolved.stderr || resolved.stdout || "").trim() ||
      `exit=${resolved.status}`;
    return {
      token: "",
      source: "none",
      reason: detail,
    };
  }

  const token = (resolved.stdout || "").trim();
  if (!token) {
    return {
      token: "",
      source: "none",
      reason: "resolved empty token output",
    };
  }

  return {
    token,
    source: "resolved",
    reason: "",
  };
}

async function callThreads(headers = {}) {
  const response = await fetch(`${baseUrl}/api/v1/threads`, {
    method: "GET",
    headers,
  });
  const text = await response.text();

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    text,
    payload,
    headers: {
      requestId: response.headers.get("x-request-id") || "-",
      source: response.headers.get("x-hodam-threads-source") || "-",
      degraded: response.headers.get("x-hodam-threads-degraded") || "-",
      reasons: response.headers.get("x-hodam-threads-degraded-reasons") || "-",
    },
  };
}

async function callThreadDetail(threadId, headers = {}) {
  const response = await fetch(`${baseUrl}/api/v1/threads/${threadId}`, {
    method: "GET",
    headers,
  });
  const text = await response.text();

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    text,
    payload,
    headers: {
      requestId: response.headers.get("x-request-id") || "-",
      source: response.headers.get("x-hodam-threads-source") || "-",
      degraded: response.headers.get("x-hodam-threads-degraded") || "-",
      reasons: response.headers.get("x-hodam-threads-degraded-reasons") || "-",
    },
  };
}

function summarizeResult(label, result) {
  const hasThreadsArray = Boolean(result.payload && Array.isArray(result.payload.threads));
  const threadsCount = hasThreadsArray ? result.payload.threads.length : "-";
  const errorMessage =
    result.payload && typeof result.payload.error === "string"
      ? result.payload.error
      : "-";

  console.log(
    `${label}: status=${result.status} requestId=${result.headers.requestId} source=${result.headers.source} degraded=${result.headers.degraded} reasons=${result.headers.reasons} threads=${threadsCount} error=${errorMessage}`,
  );
}

function summarizeDetailResult(label, result) {
  const hasThreadObject = Boolean(result.payload && result.payload.thread);
  const threadId =
    hasThreadObject && Number.isFinite(Number(result.payload.thread.id))
      ? Number(result.payload.thread.id)
      : "-";
  const messagesCount =
    result.payload && Array.isArray(result.payload.messages)
      ? result.payload.messages.length
      : "-";
  const errorMessage =
    result.payload && typeof result.payload.error === "string"
      ? result.payload.error
      : "-";

  console.log(
    `${label}: status=${result.status} requestId=${result.headers.requestId} source=${result.headers.source} degraded=${result.headers.degraded} reasons=${result.headers.reasons} threadId=${threadId} messages=${messagesCount} error=${errorMessage}`,
  );
}

function formatUnexpectedStatusErrorMessage(
  expectedStatus,
  result,
  contextLabel,
) {
  const bodySnippet = (result.text || "").slice(0, 300).replace(/\s+/g, " ");
  const hint =
    result.status >= 500 && result.headers.requestId === "-"
      ? " (hint: another process may be serving this port; set HODAM_API_BASE_URL)"
      : "";

  return `Expected ${expectedStatus} for ${contextLabel}, got ${result.status} (requestId=${result.headers.requestId}) body="${bodySnippet}"${hint}`;
}

function assertRequestIdPresent(result, contextLabel) {
  const requestId = result.headers.requestId;
  if (requestId === "-") {
    throw new Error(
      `Missing x-request-id for ${contextLabel}. body="${(result.text || "").slice(0, 300)}"`,
    );
  }
}

async function main() {
  console.log(`HODAM /api/v1/threads check base=${baseUrl}`);
  console.log(
    `- authorized check enforcement: ${requireAuthorized ? "required" : "optional"}`,
  );

  const unauth = await callThreads();
  summarizeResult("unauthorized", unauth);
  assertRequestIdPresent(unauth, "unauthorized request");
  if (unauth.status !== 401) {
    throw new Error(
      formatUnexpectedStatusErrorMessage(
        401,
        unauth,
        "unauthorized request",
      ),
    );
  }

  const invalidToken = await callThreads({
    Authorization: "Bearer invalid-token",
  });
  summarizeResult("invalid-token", invalidToken);
  assertRequestIdPresent(invalidToken, "invalid token request");
  if (invalidToken.status !== 401) {
    throw new Error(
      formatUnexpectedStatusErrorMessage(
        401,
        invalidToken,
        "invalid token request",
      ),
    );
  }

  const resolution = resolveOptionalAccessToken();
  if (!resolution.token) {
    const message = `Skipping authorized check (${resolution.reason || "token unavailable"})`;
    if (requireAuthorized) {
      throw new Error(message);
    }

    console.log(message);
    return;
  }

  const authorized = await callThreads({
    Authorization: `Bearer ${resolution.token}`,
  });
  summarizeResult(`authorized(tokenSource=${resolution.source})`, authorized);
  assertRequestIdPresent(authorized, "authorized request");
  if (authorized.status !== 200) {
    throw new Error(
      `Expected 200 for authorized request, got ${authorized.status}: ${authorized.text.slice(0, 300)}`,
    );
  }

  if (!authorized.payload || !Array.isArray(authorized.payload.threads)) {
    throw new Error("Authorized response missing threads array");
  }

  if (authorized.payload.threads.length === 0) {
    console.log(
      "• Authorized thread list is empty; skipping /api/v1/threads/:id detail check",
    );
    return;
  }

  const firstThreadId = Number(authorized.payload.threads[0]?.id);
  if (!Number.isFinite(firstThreadId) || firstThreadId <= 0) {
    throw new Error("Authorized thread list returned invalid first thread id");
  }

  const detail = await callThreadDetail(firstThreadId, {
    Authorization: `Bearer ${resolution.token}`,
  });
  summarizeDetailResult(`detail(threadId=${firstThreadId})`, detail);
  assertRequestIdPresent(detail, "authorized thread detail request");
  if (detail.status !== 200) {
    throw new Error(
      `Expected 200 for thread detail request, got ${detail.status}: ${detail.text.slice(0, 300)}`,
    );
  }
}

main().catch(error => {
  console.error(
    "check-threads-local failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
