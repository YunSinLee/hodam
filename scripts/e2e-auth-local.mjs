#!/usr/bin/env node

import fs from "fs";
import { spawn, spawnSync } from "child_process";
import path from "path";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";
import { shouldRequireAuthFlow } from "./lib/auth-e2e-utils.mjs";

const cwd = process.cwd();
const fileEnv = loadLocalEnv({ cwd }).merged;

function readEnv(name, fallback = "") {
  return readEnvValue(name, {
    processEnv: process.env,
    fileEnv,
    fallback,
  });
}

const rawAppPort = readEnv("HODAM_E2E_APP_PORT");
const appPort = Number(rawAppPort || "3003");
const providers = readEnv("HODAM_E2E_OAUTH_PROVIDERS", "google,kakao")
  .split(",")
  .map(item => item.trim().toLowerCase())
  .filter(Boolean)
  .join(",");
const appBaseUrl = `http://localhost:${appPort}`;
const authCallbackUrl = `${appBaseUrl}/auth/callback`;
const requireAuthFlow = shouldRequireAuthFlow({
  explicitValue: readEnv("HODAM_E2E_REQUIRE_AUTH"),
  processEnv: process.env,
});
const running = [];

function resetNextArtifacts() {
  const nextDirPath = path.join(cwd, ".next");
  try {
    fs.rmSync(nextDirPath, { recursive: true, force: true });
    console.log("✓ reset .next artifacts for stable dev boot");
  } catch (error) {
    console.warn(
      `warn: failed to reset .next artifacts (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

if (!Number.isFinite(appPort) || appPort <= 0) {
  console.error(`Invalid HODAM_E2E_APP_PORT: ${rawAppPort}`);
  process.exit(1);
}

function prefixStream(stream, prefix) {
  stream.on("data", chunk => {
    const text = chunk.toString("utf8");
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach(line => {
        console.log(`[${prefix}] ${line}`);
      });
  });
}

function spawnProcess({
  name,
  command,
  args,
  env = {},
  stdio = ["ignore", "pipe", "pipe"],
}) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio,
  });

  running.push(child);
  if (stdio === "inherit") {
    return child;
  }

  prefixStream(child.stdout, name);
  prefixStream(child.stderr, `${name}:err`);
  return child;
}

async function waitForUrl(url, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 401 || response.status === 404) {
        return response.status;
      }
    } catch {
      // keep waiting
    }

    await new Promise(resolve => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`Timeout waiting for ${url}`);
}

function isTransientNextManifestError(status, body) {
  if (status < 500) return false;
  const normalized = String(body || "").toLowerCase();
  return (
    normalized.includes("unexpected end of json input") ||
    normalized.includes("\"statuscode\":500")
  );
}

async function expectStatus(
  url,
  expectedStatus,
  init = {},
  { maxAttempts = 1, retryDelayMs = 500 } = {},
) {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, init);
    const body = await response.text();
    lastStatus = response.status;
    lastBody = body;

    if (response.status === expectedStatus) {
      return body;
    }

    if (
      attempt < maxAttempts &&
      isTransientNextManifestError(response.status, body)
    ) {
      await new Promise(resolve => {
        setTimeout(resolve, retryDelayMs);
      });
      continue;
    }

    break;
  }

  throw new Error(
    `${url} expected ${expectedStatus} but got ${lastStatus}: ${lastBody}`,
  );
}

async function expectJsonStatus(
  url,
  expectedStatus,
  init = {},
  retryOptions = {},
) {
  const bodyText = await expectStatus(url, expectedStatus, init, retryOptions);
  let body = null;

  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(`${url} expected JSON response but got: ${bodyText}`);
  }

  if (!body || typeof body !== "object") {
    throw new Error(`${url} expected JSON object response`);
  }

  return body;
}

async function expectHtmlContains(
  url,
  expectedText,
  retryOptions = {},
) {
  const html = await expectStatus(url, 200, {}, retryOptions);
  if (!html.includes(expectedText)) {
    throw new Error(`${url} missing expected text: ${expectedText}`);
  }
}

function shouldRetryAuthedApiRequest(status, bodyText) {
  if (status >= 500) {
    return true;
  }

  if (status !== 401) {
    return false;
  }

  const normalizedBody = String(bodyText || "").toLowerCase();
  return (
    normalizedBody.includes("\"code\":\"auth_unauthorized\"") ||
    normalizedBody.includes("temporary auth lookup failure") ||
    normalizedBody.includes("getaddrinfo enotfound")
  );
}

async function fetchWithRetry(
  url,
  init = {},
  {
    maxAttempts = 1,
    retryDelayMs = 500,
    shouldRetry = () => false,
  } = {},
) {
  let response = null;
  let bodyText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch(url, init);
    bodyText = await response.text();

    if (attempt >= maxAttempts) {
      break;
    }

    if (!shouldRetry(response.status, bodyText)) {
      break;
    }

    await new Promise(resolve => {
      setTimeout(resolve, retryDelayMs);
    });
  }

  if (!response) {
    throw new Error(`No response returned for ${url}`);
  }

  return {
    response,
    bodyText,
  };
}

function extractScriptSrcList(html) {
  const result = [];
  const regex = /<script[^>]+src="([^"]+)"[^>]*>/gi;
  let match = regex.exec(html);

  while (match) {
    result.push(match[1]);
    match = regex.exec(html);
  }

  return result;
}

async function assertAppChunksReachable(pageName, pageUrl) {
  const pageHtml = await expectStatus(
    pageUrl,
    200,
    {},
    { maxAttempts: 4, retryDelayMs: 700 },
  );
  const appChunkSrcList = extractScriptSrcList(pageHtml).filter(src =>
    src.startsWith("/_next/static/chunks/app/"),
  );

  if (appChunkSrcList.length === 0) {
    throw new Error(`${pageName} page missing app chunk script tags`);
  }

  for (const chunkSrc of appChunkSrcList) {
    const chunkUrl = new URL(chunkSrc, appBaseUrl).toString();
    await expectStatus(chunkUrl, 200, {}, { maxAttempts: 3, retryDelayMs: 400 });
  }
  console.log(`✓ ${pageName} app chunks are reachable`);
}

function killChild(child) {
  if (!child || child.killed) return;

  try {
    child.kill("SIGINT");
  } catch {
    // ignore
  }
}

async function cleanup() {
  running.forEach(killChild);
  await new Promise(resolve => {
    setTimeout(resolve, 500);
  });
  running.forEach(child => {
    if (!child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  });
}

async function runOAuthCheck() {
  return await new Promise((resolve, reject) => {
    const child = spawnProcess({
      name: "check-oauth",
      command: process.execPath,
      args: [
        path.join("scripts", "check-oauth.mjs"),
        `--runtime-origin=${appBaseUrl}`,
        `--providers=${providers}`,
      ],
      env: {
        NEXT_PUBLIC_SITE_URL: appBaseUrl,
        NEXT_PUBLIC_AUTH_REDIRECT_URL: authCallbackUrl,
      },
      stdio: "inherit",
    });

    child.on("exit", code => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`check-oauth exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

function runEnsureTestUserIfRequested() {
  const explicitEnsure = readEnv("HODAM_E2E_ENSURE_TEST_USER");
  const autoEnsureEnabled = readEnv("HODAM_E2E_AUTO_ENSURE_TEST_USER", "1") !== "0";
  const hasServiceRoleKey = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const shouldEnsure =
    explicitEnsure === "1" ||
    (explicitEnsure !== "0" && autoEnsureEnabled && hasServiceRoleKey);

  if (!shouldEnsure) {
    return;
  }

  const autoUserFlag =
    readEnv("HODAM_TEST_AUTO_USER") || (hasServiceRoleKey ? "1" : "0");

  const ensured = spawnSync(
    process.execPath,
    [path.join("scripts", "ensure-test-user.mjs")],
    {
      cwd,
      env: {
        ...process.env,
        HODAM_TEST_AUTO_USER: autoUserFlag,
      },
      encoding: "utf8",
    },
  );

  if (ensured.status !== 0) {
    const detail =
      (ensured.stderr || ensured.stdout || "").trim() ||
      `exit=${ensured.status}`;
    throw new Error(`ensure-test-user failed: ${detail}`);
  }

  const output = (ensured.stdout || "").trim();
  if (output) {
    console.log(`✓ ${output}`);
  }
}

function resolveOptionalAccessToken() {
  const hasServiceRoleKey = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const autoUserFlag =
    readEnv("HODAM_TEST_AUTO_USER") || (hasServiceRoleKey ? "1" : "0");
  const explicit = readEnv("HODAM_TEST_ACCESS_TOKEN");
  const email = readEnv("HODAM_TEST_USER_EMAIL");
  const password = readEnv("HODAM_TEST_USER_PASSWORD");
  const hasCredentialHints = Boolean(explicit || email || password);

  if (explicit) {
    return {
      token: explicit,
      source: "env",
      skipReason: "",
      hasCredentialHints,
    };
  }

  const resolved = spawnSync(
    process.execPath,
    [path.join("scripts", "get-test-access-token.mjs")],
    {
      cwd,
      env: {
        ...process.env,
        HODAM_TEST_AUTO_USER: autoUserFlag,
      },
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
      skipReason: detail,
      hasCredentialHints,
    };
  }

  const token = (resolved.stdout || "").trim();
  if (!token) {
    return {
      token: "",
      source: "none",
      skipReason: "resolved empty token output",
      hasCredentialHints,
    };
  }

  return {
    token,
    source: "resolved",
    skipReason: "",
    hasCredentialHints,
  };
}

async function main() {
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  runEnsureTestUserIfRequested();
  resetNextArtifacts();
  const accessTokenResolution = resolveOptionalAccessToken();
  console.log(
    `- auth flow enforcement: ${requireAuthFlow ? "required" : "optional"}`,
  );

  console.log("Starting Next.js dev server...");
  spawnProcess({
    name: "next-dev",
    command: process.execPath,
    args: [nextBin, "dev", "-p", String(appPort)],
    env: {
      NEXT_PUBLIC_SITE_URL: appBaseUrl,
      NEXT_PUBLIC_AUTH_REDIRECT_URL: authCallbackUrl,
    },
  });

  await waitForUrl(`${appBaseUrl}/`, { timeoutMs: 75_000 });

  const signInHtml = await expectStatus(
    `${appBaseUrl}/sign-in`,
    200,
    {},
    { maxAttempts: 6, retryDelayMs: 700 },
  );
  console.log(`✓ sign-in page reachable (${appBaseUrl}/sign-in)`);
  if (!signInHtml.includes("카카오로 시작하기")) {
    throw new Error("sign-in page missing '카카오로 시작하기' CTA");
  }
  if (!signInHtml.includes("Google로 시작하기")) {
    throw new Error("sign-in page missing 'Google로 시작하기' CTA");
  }
  console.log("✓ social login CTAs rendered");

  const providerHealthBody = await expectJsonStatus(
    `${appBaseUrl}/api/v1/auth/providers`,
    200,
    {},
    { maxAttempts: 4, retryDelayMs: 500 },
  );
  if (
    !providerHealthBody ||
    typeof providerHealthBody !== "object" ||
    !providerHealthBody.providers ||
    typeof providerHealthBody.providers !== "object"
  ) {
    throw new Error("/api/v1/auth/providers response missing providers object");
  }
  ["google", "kakao"].forEach(provider => {
    const providerItem = providerHealthBody.providers[provider];
    if (!providerItem || typeof providerItem !== "object") {
      throw new Error(
        `/api/v1/auth/providers missing provider status for ${provider}`,
      );
    }

    if (
      providerItem.enabled !== true &&
      providerItem.enabled !== false &&
      providerItem.enabled !== null
    ) {
      throw new Error(
        `/api/v1/auth/providers invalid enabled state for ${provider}: ${String(
          providerItem.enabled,
        )}`,
      );
    }

    if (providerItem.enabled === false) {
      throw new Error(
        `${provider} OAuth provider disabled: ${providerItem.reason || "unknown reason"}`,
      );
    }
  });
  console.log("✓ /api/v1/auth/providers health contract looks valid");

  const signInRecoveryCodes = [
    "timeout",
    "invalid_grant",
    "invalid_request",
    "expired_code",
    "callback_missing",
    "callback_failed",
    "access_denied",
  ];
  for (const recoveryCode of signInRecoveryCodes) {
    await expectStatus(
      `${appBaseUrl}/sign-in?auth_error=${encodeURIComponent(recoveryCode)}`,
      200,
      {},
      { maxAttempts: 4, retryDelayMs: 500 },
    );
  }
  console.log("✓ sign-in recovery routes reachable");

  await assertAppChunksReachable("home", `${appBaseUrl}/`);
  await assertAppChunksReachable("sign-in", `${appBaseUrl}/sign-in`);

  const noAuthResponse = await expectJsonStatus(
    `${appBaseUrl}/api/v1/threads`,
    401,
  );
  if (
    noAuthResponse.error !== "Unauthorized" ||
    noAuthResponse.code !== "AUTH_UNAUTHORIZED"
  ) {
    throw new Error("/api/v1/threads 401 response missing Unauthorized message");
  }
  console.log("✓ /api/v1/threads returns 401+AUTH_UNAUTHORIZED without token");
  const noAuthDetailResponse = await expectJsonStatus(
    `${appBaseUrl}/api/v1/threads/1`,
    401,
  );
  if (
    noAuthDetailResponse.error !== "Unauthorized" ||
    noAuthDetailResponse.code !== "AUTH_UNAUTHORIZED"
  ) {
    throw new Error(
      "/api/v1/threads/:id 401 response missing Unauthorized message",
    );
  }
  console.log(
    "✓ /api/v1/threads/:id returns 401+AUTH_UNAUTHORIZED without token",
  );

  const invalidTokenResponse = await expectJsonStatus(
    `${appBaseUrl}/api/v1/threads`,
    401,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    },
  );
  if (
    invalidTokenResponse.error !== "Unauthorized" ||
    invalidTokenResponse.code !== "AUTH_UNAUTHORIZED"
  ) {
    throw new Error(
      "/api/v1/threads with invalid token should return Unauthorized message",
    );
  }
  console.log(
    "✓ /api/v1/threads returns 401+AUTH_UNAUTHORIZED for invalid token",
  );
  const invalidTokenDetailResponse = await expectJsonStatus(
    `${appBaseUrl}/api/v1/threads/1`,
    401,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    },
  );
  if (
    invalidTokenDetailResponse.error !== "Unauthorized" ||
    invalidTokenDetailResponse.code !== "AUTH_UNAUTHORIZED"
  ) {
    throw new Error(
      "/api/v1/threads/:id with invalid token should return Unauthorized message",
    );
  }
  console.log(
    "✓ /api/v1/threads/:id returns 401+AUTH_UNAUTHORIZED for invalid token",
  );

  if (accessTokenResolution.token) {
    const { response: authedResponse, bodyText: authedBodyText } =
      await fetchWithRetry(
        `${appBaseUrl}/api/v1/threads`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessTokenResolution.token}`,
          },
        },
        {
          maxAttempts: 3,
          retryDelayMs: 700,
          shouldRetry: shouldRetryAuthedApiRequest,
        },
      );
    if (authedResponse.status !== 200) {
      throw new Error(
        `/api/v1/threads expected 200 with test token but got ${authedResponse.status}: ${authedBodyText}`,
      );
    }

    let authedBody;
    try {
      authedBody = JSON.parse(authedBodyText);
    } catch {
      throw new Error("/api/v1/threads returned non-JSON response");
    }

    if (!authedBody || !Array.isArray(authedBody.threads)) {
      throw new Error("/api/v1/threads response missing threads array");
    }

    const source = authedResponse.headers.get("x-hodam-threads-source") || "none";
    const degraded = authedResponse.headers.get("x-hodam-threads-degraded") || "0";
    const reasons =
      authedResponse.headers.get("x-hodam-threads-degraded-reasons") || "-";

    console.log(
      `✓ /api/v1/threads with test token returned 200 (tokenSource=${accessTokenResolution.source}, source=${source}, degraded=${degraded}, reasons=${reasons})`,
    );

    if (authedBody.threads.length === 0) {
      console.log("• Skipping /api/v1/threads/:id check (no threads available)");
    } else {
      const firstThreadId = Number(authedBody.threads[0]?.id);
      if (!Number.isFinite(firstThreadId) || firstThreadId <= 0) {
        throw new Error("/api/v1/threads returned invalid thread id");
      }

      const { response: detailResponse, bodyText: detailBodyText } =
        await fetchWithRetry(
          `${appBaseUrl}/api/v1/threads/${firstThreadId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessTokenResolution.token}`,
            },
          },
          {
            maxAttempts: 3,
            retryDelayMs: 700,
            shouldRetry: shouldRetryAuthedApiRequest,
          },
        );
      if (detailResponse.status !== 200) {
        throw new Error(
          `/api/v1/threads/${firstThreadId} expected 200 with test token but got ${detailResponse.status}: ${detailBodyText}`,
        );
      }

      let detailBody;
      try {
        detailBody = JSON.parse(detailBodyText);
      } catch {
        throw new Error(`/api/v1/threads/${firstThreadId} returned non-JSON response`);
      }

      if (!detailBody || !detailBody.thread || !Array.isArray(detailBody.messages)) {
        throw new Error(
          `/api/v1/threads/${firstThreadId} response missing expected thread/messages shape`,
        );
      }

      const detailSource =
        detailResponse.headers.get("x-hodam-threads-source") || "none";
      const detailDegraded =
        detailResponse.headers.get("x-hodam-threads-degraded") || "0";
      const detailReasons =
        detailResponse.headers.get("x-hodam-threads-degraded-reasons") || "-";
      console.log(
        `✓ /api/v1/threads/${firstThreadId} returned 200 (source=${detailSource}, degraded=${detailDegraded}, reasons=${detailReasons}, messages=${detailBody.messages.length})`,
      );
    }

    const invalidThreadIdBody = await expectJsonStatus(
      `${appBaseUrl}/api/v1/threads/invalid-thread-id`,
      400,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessTokenResolution.token}`,
        },
      },
      { maxAttempts: 3, retryDelayMs: 400 },
    );
    if (
      invalidThreadIdBody.error !== "Invalid threadId" ||
      invalidThreadIdBody.code !== "THREAD_ID_INVALID"
    ) {
      throw new Error(
        `/api/v1/threads/:id invalid id response mismatch: ${JSON.stringify(
          invalidThreadIdBody,
        )}`,
      );
    }
    console.log("✓ /api/v1/threads/:id validates invalid id with THREAD_ID_INVALID");

    const notFoundThreadId = 99999999;
    const notFoundThreadBody = await expectJsonStatus(
      `${appBaseUrl}/api/v1/threads/${notFoundThreadId}`,
      404,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessTokenResolution.token}`,
        },
      },
      { maxAttempts: 3, retryDelayMs: 400 },
    );
    if (
      notFoundThreadBody.error !== "Thread not found" ||
      notFoundThreadBody.code !== "THREAD_NOT_FOUND"
    ) {
      throw new Error(
        `/api/v1/threads/:id not-found response mismatch: ${JSON.stringify(
          notFoundThreadBody,
        )}`,
      );
    }
    console.log("✓ /api/v1/threads/:id validates missing thread with THREAD_NOT_FOUND");
  } else {
    if (requireAuthFlow) {
      throw new Error(
        `Failed to resolve HODAM_TEST_ACCESS_TOKEN: ${
          accessTokenResolution.skipReason || "unknown error"
        }. Set HODAM_TEST_ACCESS_TOKEN or HODAM_TEST_USER_EMAIL/HODAM_TEST_USER_PASSWORD (or provide SUPABASE_SERVICE_ROLE_KEY with HODAM_TEST_AUTO_USER=1).`,
      );
    }

    if (accessTokenResolution.hasCredentialHints) {
      throw new Error(
        `Failed to resolve test access token with provided credentials: ${accessTokenResolution.skipReason || "unknown error"}`,
      );
    }

    console.log(
      `• Skipping authorized /api/v1/threads check (${accessTokenResolution.skipReason || "test token unavailable"}).`,
    );
  }

  await waitForUrl(`${appBaseUrl}/auth/callback`, { timeoutMs: 20_000 });
  console.log("✓ auth callback page reachable");
  await expectHtmlContains(
    `${appBaseUrl}/auth/callback`,
    "로그인 처리 중",
    { maxAttempts: 3, retryDelayMs: 400 },
  );
  console.log("✓ auth callback loading UI rendered");
  await assertAppChunksReachable("auth callback", `${appBaseUrl}/auth/callback`);

  await expectStatus(
    `${appBaseUrl}/auth/callback?code=e2e-placeholder-code`,
    200,
    {},
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  await expectStatus(
    `${appBaseUrl}/auth/callback?error=access_denied`,
    200,
    {},
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  await expectStatus(
    `${appBaseUrl}/auth/callback?error=invalid_grant&error_description=authorization%20code%20expired`,
    200,
    {},
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  await expectStatus(
    `${appBaseUrl}/auth/callback?error=invalid_request&error_description=missing%20code%20verifier`,
    200,
    {},
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  await expectStatus(
    `${appBaseUrl}/auth/callback?auth_debug=1`,
    200,
    {},
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  console.log("✓ auth callback handles code/error query payload routes");

  const oauthAttemptId = `e2e-auth-attempt-${Date.now()}`;
  const diagnosticsBody = await expectJsonStatus(
    `${appBaseUrl}/api/v1/auth/callback/metrics`,
    200,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        stage: "exchange_start",
        callbackPath: "/auth/callback",
        timestampMs: Date.now(),
        details: {
          source: "e2e-auth-local",
          hasCode: true,
          oauthAttemptId,
        },
      }),
    },
  );
  if (diagnosticsBody.accepted !== true) {
    throw new Error("/api/v1/auth/callback/metrics response missing accepted=true");
  }
  console.log("✓ auth callback diagnostics endpoint accepts metric events");

  const recentDiagnosticsUrl =
    `${appBaseUrl}/api/v1/auth/callback/metrics/recent?` +
    new URLSearchParams({
      attemptId: oauthAttemptId,
      limit: "10",
    }).toString();
  const hasPostedAttemptEvent = payload =>
    Array.isArray(payload?.events)
      ? payload.events.some(
          event =>
            event &&
            typeof event === "object" &&
            event.stage === "exchange_start" &&
            event.details &&
            typeof event.details === "object" &&
            event.details.oauthAttemptId === oauthAttemptId,
        )
      : false;
  let recentDiagnosticsBody = null;
  let recentEventFound = false;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    recentDiagnosticsBody = await expectJsonStatus(recentDiagnosticsUrl, 200, {
      method: "GET",
    });
    recentEventFound = hasPostedAttemptEvent(recentDiagnosticsBody);
    if (recentDiagnosticsBody.degraded === true || recentEventFound) {
      break;
    }
    await new Promise(resolve => {
      setTimeout(resolve, 350);
    });
  }

  if (recentDiagnosticsBody.attemptId !== oauthAttemptId) {
    throw new Error(
      `/api/v1/auth/callback/metrics/recent attemptId mismatch: ${JSON.stringify(
        recentDiagnosticsBody,
      )}`,
    );
  }
  if (recentDiagnosticsBody.degraded === true) {
    console.log(
      `• auth callback recent diagnostics endpoint degraded (${recentDiagnosticsBody.degradedReason || "unknown"})`,
    );
  } else {
    if (!recentEventFound) {
      console.log(
        "• auth callback recent diagnostics endpoint returned no events (analytics persistence may be disabled without service-role key).",
      );
    } else {
      console.log(
        "✓ auth callback recent diagnostics endpoint returns attempt events",
      );
    }
  }

  console.log("Running OAuth provider diagnostics...");
  await runOAuthCheck();

  console.log("Auth e2e local check passed.");
}

let interrupted = false;
["SIGINT", "SIGTERM"].forEach(signal => {
  process.on(signal, async () => {
    if (interrupted) return;
    interrupted = true;
    await cleanup();
    process.exit(130);
  });
});

main()
  .catch(async error => {
    console.error(
      "Auth e2e local check failed:",
      error instanceof Error ? error.message : String(error),
    );
    await cleanup();
    process.exit(1);
  })
  .then(async () => {
    await cleanup();
  });
