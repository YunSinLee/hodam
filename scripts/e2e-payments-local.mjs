#!/usr/bin/env node

import { spawn, spawnSync } from "child_process";
import path from "path";

const cwd = process.cwd();
const appPort = Number(process.env.HODAM_E2E_APP_PORT || "3002");
const tossPort = Number(process.env.HODAM_E2E_TOSS_PORT || "4010");
const paymentPackageId = (process.env.HODAM_TEST_PAYMENT_PACKAGE_ID || "bead_5").trim();
const paymentKey = (process.env.HODAM_TEST_PAYMENT_KEY || "mock_payment_key").trim();
const runWebhookFlow = process.env.HODAM_TEST_PAYMENT_WEBHOOK === "1";

const appBaseUrl = `http://localhost:${appPort}`;
const tossBaseUrl = `http://localhost:${tossPort}`;
const authCallbackUrl = `${appBaseUrl}/auth/callback`;
const requireAuthFlow = process.env.HODAM_E2E_REQUIRE_AUTH === "1";

if (!Number.isFinite(appPort) || appPort <= 0) {
  console.error(`Invalid HODAM_E2E_APP_PORT: ${process.env.HODAM_E2E_APP_PORT}`);
  process.exit(1);
}

if (!Number.isFinite(tossPort) || tossPort <= 0) {
  console.error(`Invalid HODAM_E2E_TOSS_PORT: ${process.env.HODAM_E2E_TOSS_PORT}`);
  process.exit(1);
}

const running = [];

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

function resolveAccessTokenWithMeta() {
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

async function expectStatus(url, expectedStatus, init = {}) {
  const response = await fetch(url, init);
  const bodyText = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `${url} expected ${expectedStatus} but got ${response.status}: ${bodyText.slice(0, 300)}`,
    );
  }
}

async function runUnauthorizedSmoke() {
  await expectStatus(`${appBaseUrl}/api/v1/payments/history`, 401, {
    method: "GET",
  });
  await expectStatus(`${appBaseUrl}/api/v1/payments/prepare`, 401, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId: paymentPackageId }),
  });
  await expectStatus(`${appBaseUrl}/api/v1/payments/confirm`, 401, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentKey,
      orderId: `UNAUTH_${Date.now()}`,
      amount: 1000,
    }),
  });
  await expectStatus(
    `${appBaseUrl}/api/v1/payments/status?orderId=${encodeURIComponent(
      `UNAUTH_${Date.now()}`,
    )}`,
    401,
    {
      method: "GET",
    },
  );
  await expectStatus(`${appBaseUrl}/bead`, 200, { method: "GET" });
}

function runEnsureTestUserIfRequested() {
  if (process.env.HODAM_E2E_ENSURE_TEST_USER !== "1") {
    return;
  }

  const ensured = spawnSync(
    process.execPath,
    [path.join("scripts", "ensure-test-user.mjs")],
    {
      cwd,
      env: process.env,
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
  runEnsureTestUserIfRequested();
  const accessTokenResult = resolveAccessTokenWithMeta();
  const accessToken = accessTokenResult.token;

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
        process.env.TOSS_PAYMENTS_SECRET_KEY || "mock_toss_secret",
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
      `Failed to resolve HODAM_TEST_ACCESS_TOKEN: ${accessTokenResult.reason || "unknown error"}`,
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
