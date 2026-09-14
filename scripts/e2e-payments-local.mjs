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
const rawTossPort = readEnv("HODAM_E2E_TOSS_PORT");
const appPort = Number(rawAppPort || "3002");
const tossPort = Number(rawTossPort || "4010");
const paymentPackageId = readEnv("HODAM_TEST_PAYMENT_PACKAGE_ID", "bead_5");
const paymentKey = readEnv("HODAM_TEST_PAYMENT_KEY", "mock_payment_key");
let runWebhookFlow = readEnv("HODAM_TEST_PAYMENT_WEBHOOK") === "1";
const forceUnauthorizedFlow = readEnv("HODAM_E2E_FORCE_UNAUTHORIZED") === "1";

const appBaseUrl = `http://localhost:${appPort}`;
const tossBaseUrl = `http://localhost:${tossPort}`;
const authCallbackUrl = `${appBaseUrl}/auth/callback`;
const requireAuthFlow = shouldRequireAuthFlow({
  explicitValue: readEnv("HODAM_E2E_REQUIRE_AUTH"),
  processEnv: process.env,
});
const allowWebhookSkip = readEnv("HODAM_E2E_ALLOW_WEBHOOK_SKIP") === "1";

if (!Number.isFinite(appPort) || appPort <= 0) {
  console.error(`Invalid HODAM_E2E_APP_PORT: ${rawAppPort}`);
  process.exit(1);
}

if (!Number.isFinite(tossPort) || tossPort <= 0) {
  console.error(`Invalid HODAM_E2E_TOSS_PORT: ${rawTossPort}`);
  process.exit(1);
}

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
}) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  running.push(child);
  prefixStream(child.stdout, name);
  prefixStream(child.stderr, `${name}:err`);

  return child;
}

async function waitForUrl(url, {
  timeoutMs = 45_000,
  intervalMs = 500,
  headers = {},
} = {}) {
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
      });
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

async function runSmoke(accessToken) {
  const smokeArgs = [path.join("scripts", "smoke-v1.mjs"), "--payments", "--payments-confirm"];
  if (runWebhookFlow) {
    smokeArgs.push("--payments-webhook");
  }

  return await new Promise((resolve, reject) => {
    const smoke = spawn(
      process.execPath,
      smokeArgs,
      {
        cwd,
        env: {
          ...process.env,
          HODAM_API_BASE_URL: appBaseUrl,
          HODAM_TEST_ACCESS_TOKEN: accessToken,
          HODAM_TEST_PAYMENT_CONFIRM: "1",
          HODAM_TEST_PAYMENT_WEBHOOK: runWebhookFlow ? "1" : "0",
          HODAM_TEST_PAYMENT_PACKAGE_ID: paymentPackageId,
          HODAM_TEST_PAYMENT_KEY: paymentKey,
        },
        stdio: "inherit",
      },
    );

    smoke.on("exit", code => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`smoke-v1 exited with code ${code}`));
      }
    });
    smoke.on("error", reject);
  });
}

function isTransientNextManifestError(status, body) {
  if (status < 500) return false;
  const normalized = String(body || "").toLowerCase();
  return (
    normalized.includes("unexpected end of json input") ||
    normalized.includes("\"statuscode\":500")
  );
}

function resolveAccessTokenWithMeta() {
  const hasServiceRoleKey = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const autoUserFlag =
    readEnv("HODAM_TEST_AUTO_USER") || (hasServiceRoleKey ? "1" : "0");
  if (forceUnauthorizedFlow) {
    return {
      token: "",
      source: "forced-unauthorized",
      reason: "forced by HODAM_E2E_FORCE_UNAUTHORIZED=1",
    };
  }

  const explicit = readEnv("HODAM_TEST_ACCESS_TOKEN");
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
      source: "script",
      reason: detail,
    };
  }

  const token = (resolved.stdout || "").trim();
  if (!token) {
    return {
      token: "",
      source: "script",
      reason: "empty token output",
    };
  }

  return {
    token,
    source: "script",
    reason: "",
  };
}

function resolveWebhookFlowMode() {
  if (!runWebhookFlow) {
    return;
  }

  if (readEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    return;
  }

  if (allowWebhookSkip) {
    console.warn(
      "warn: SUPABASE_SERVICE_ROLE_KEY missing, disabling webhook e2e flow (set HODAM_E2E_ALLOW_WEBHOOK_SKIP=0 to fail hard).",
    );
    runWebhookFlow = false;
    return;
  }

  throw new Error(
    "HODAM_TEST_PAYMENT_WEBHOOK=1 requires SUPABASE_SERVICE_ROLE_KEY. Set the key or unset HODAM_TEST_PAYMENT_WEBHOOK.",
  );
}

async function expectStatus(
  url,
  expectedStatus,
  init = {},
  { maxAttempts = 1, retryDelayMs = 500 } = {},
) {
  let lastStatus = 0;
  let lastBodyText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, init);
    const bodyText = await response.text();
    lastStatus = response.status;
    lastBodyText = bodyText;

    if (response.status === expectedStatus) {
      return bodyText;
    }

    if (
      attempt < maxAttempts &&
      isTransientNextManifestError(response.status, bodyText)
    ) {
      await new Promise(resolve => {
        setTimeout(resolve, retryDelayMs);
      });
      continue;
    }

    break;
  }

  throw new Error(
    `${url} expected ${expectedStatus} but got ${lastStatus}: ${lastBodyText.slice(0, 300)}`,
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

async function runUnauthorizedSmoke() {
  const history = await expectJsonStatus(
    `${appBaseUrl}/api/v1/payments/history`,
    401,
    {
      method: "GET",
    },
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  if (history.code !== "AUTH_UNAUTHORIZED") {
    throw new Error(`/api/v1/payments/history expected AUTH_UNAUTHORIZED: ${JSON.stringify(history)}`);
  }

  const prepare = await expectJsonStatus(
    `${appBaseUrl}/api/v1/payments/prepare`,
    401,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: paymentPackageId }),
    },
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  if (prepare.code !== "AUTH_UNAUTHORIZED") {
    throw new Error(`/api/v1/payments/prepare expected AUTH_UNAUTHORIZED: ${JSON.stringify(prepare)}`);
  }

  const confirm = await expectJsonStatus(
    `${appBaseUrl}/api/v1/payments/confirm`,
    401,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentKey,
        orderId: `UNAUTH_${Date.now()}`,
        amount: 1000,
      }),
    },
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  if (confirm.code !== "AUTH_UNAUTHORIZED") {
    throw new Error(`/api/v1/payments/confirm expected AUTH_UNAUTHORIZED: ${JSON.stringify(confirm)}`);
  }

  const status = await expectJsonStatus(
    `${appBaseUrl}/api/v1/payments/status?orderId=${encodeURIComponent(
      `UNAUTH_${Date.now()}`,
    )}`,
    401,
    {
      method: "GET",
    },
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  if (status.code !== "AUTH_UNAUTHORIZED") {
    throw new Error(`/api/v1/payments/status expected AUTH_UNAUTHORIZED: ${JSON.stringify(status)}`);
  }

  const timeline = await expectJsonStatus(
    `${appBaseUrl}/api/v1/payments/timeline?orderId=${encodeURIComponent(
      `UNAUTH_${Date.now()}`,
    )}`,
    401,
    {
      method: "GET",
    },
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  if (timeline.code !== "AUTH_UNAUTHORIZED") {
    throw new Error(
      `/api/v1/payments/timeline expected AUTH_UNAUTHORIZED: ${JSON.stringify(timeline)}`,
    );
  }

  const timelineByFlow = await expectJsonStatus(
    `${appBaseUrl}/api/v1/payments/timeline?paymentFlowId=${encodeURIComponent(
      `flow_unauth_${Date.now()}`,
    )}`,
    401,
    {
      method: "GET",
    },
    { maxAttempts: 3, retryDelayMs: 500 },
  );
  if (timelineByFlow.code !== "AUTH_UNAUTHORIZED") {
    throw new Error(
      `/api/v1/payments/timeline?paymentFlowId expected AUTH_UNAUTHORIZED: ${JSON.stringify(timelineByFlow)}`,
    );
  }

  await expectStatus(`${appBaseUrl}/bead`, 200, { method: "GET" });
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

async function main() {
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  resolveWebhookFlowMode();
  runEnsureTestUserIfRequested();
  resetNextArtifacts();
  const accessTokenResult = resolveAccessTokenWithMeta();
  const accessToken = accessTokenResult.token;
  console.log(
    `- auth flow enforcement: ${requireAuthFlow ? "required" : "optional"}`,
  );

  console.log("Starting mock Toss server...");
  spawnProcess({
    name: "mock-toss",
    command: process.execPath,
    args: [path.join("scripts", "mock-toss-server.mjs"), `--port=${tossPort}`],
  });
  await waitForUrl(`${tossBaseUrl}/health`, { timeoutMs: 15_000 });

  console.log("Starting Next.js dev server with mock Toss base url...");
  spawnProcess({
    name: "next-dev",
    command: process.execPath,
    args: [nextBin, "dev", "-p", String(appPort)],
    env: {
      TOSS_PAYMENTS_API_BASE_URL: tossBaseUrl,
      TOSS_PAYMENTS_SECRET_KEY:
        readEnv("TOSS_PAYMENTS_SECRET_KEY", "mock_toss_secret"),
      NEXT_PUBLIC_SITE_URL: appBaseUrl,
      NEXT_PUBLIC_AUTH_REDIRECT_URL: authCallbackUrl,
    },
  });
  if (accessToken) {
    await waitForUrl(`${appBaseUrl}/api/v1/beads`, {
      timeoutMs: 60_000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Running payment smoke (prepare + confirm + history)...");
    await runSmoke(accessToken);
    console.log(
      `Payment e2e local check passed (authenticated flow, tokenSource=${accessTokenResult.source}).`,
    );
    return;
  }

  if (requireAuthFlow) {
    throw new Error(
      `Failed to resolve HODAM_TEST_ACCESS_TOKEN: ${
        accessTokenResult.reason || "unknown error"
      }. Set HODAM_TEST_ACCESS_TOKEN or HODAM_TEST_USER_EMAIL/HODAM_TEST_USER_PASSWORD (or provide SUPABASE_SERVICE_ROLE_KEY with HODAM_TEST_AUTO_USER=1).`,
    );
  }

  await waitForUrl(`${appBaseUrl}/bead`, { timeoutMs: 60_000 });
  console.log(
    `Auth token not available. Running unauthorized payment smoke only (${accessTokenResult.reason || "token unavailable"}).`,
  );
  await runUnauthorizedSmoke();
  console.log("Payment e2e local check passed (unauthorized smoke fallback).");
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
      "Payment e2e local check failed:",
      error instanceof Error ? error.message : String(error),
    );
    await cleanup();
    process.exit(1);
  })
  .then(async () => {
    await cleanup();
  });
