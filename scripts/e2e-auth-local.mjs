#!/usr/bin/env node

import { spawn, spawnSync } from "child_process";
import path from "path";

const cwd = process.cwd();
const appPort = Number(process.env.HODAM_E2E_APP_PORT || "3003");
const providers = (process.env.HODAM_E2E_OAUTH_PROVIDERS || "google,kakao")
  .split(",")
  .map(item => item.trim().toLowerCase())
  .filter(Boolean)
  .join(",");
const appBaseUrl = `http://localhost:${appPort}`;
const authCallbackUrl = `${appBaseUrl}/auth/callback`;
const running = [];

if (!Number.isFinite(appPort) || appPort <= 0) {
  console.error(`Invalid HODAM_E2E_APP_PORT: ${process.env.HODAM_E2E_APP_PORT}`);
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

function resolveOptionalAccessToken() {
  const explicit = (process.env.HODAM_TEST_ACCESS_TOKEN || "").trim();
  const email = (process.env.HODAM_TEST_USER_EMAIL || "").trim();
  const password = (process.env.HODAM_TEST_USER_PASSWORD || "").trim();
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
  const accessTokenResolution = resolveOptionalAccessToken();

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

  const homeHtml = await expectStatus(
    `${appBaseUrl}/`,
    200,
    {},
    { maxAttempts: 4, retryDelayMs: 700 },
  );
  const homeChunkSrcList = extractScriptSrcList(homeHtml).filter(src =>
    src.startsWith("/_next/static/chunks/app/"),
  );

  if (homeChunkSrcList.length === 0) {
    throw new Error("home page missing app chunk script tags");
  }

  for (const chunkSrc of homeChunkSrcList) {
    const chunkUrl = new URL(chunkSrc, appBaseUrl).toString();
    await expectStatus(chunkUrl, 200, {}, { maxAttempts: 3, retryDelayMs: 400 });
  }
  console.log("✓ home app chunks are reachable");

  const noAuthResponse = await expectStatus(`${appBaseUrl}/api/v1/threads`, 401);
  if (!noAuthResponse.includes("Unauthorized")) {
    throw new Error("/api/v1/threads 401 response missing Unauthorized message");
  }
  console.log("✓ /api/v1/threads returns 401 without token");

  const invalidTokenResponse = await expectStatus(
    `${appBaseUrl}/api/v1/threads`,
    401,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    },
  );
  if (!invalidTokenResponse.includes("Unauthorized")) {
    throw new Error(
      "/api/v1/threads with invalid token should return Unauthorized message",
    );
  }
  console.log("✓ /api/v1/threads returns 401 for invalid token");

  if (accessTokenResolution.token) {
    const authedResponse = await fetch(`${appBaseUrl}/api/v1/threads`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessTokenResolution.token}`,
      },
    });
    const authedBodyText = await authedResponse.text();

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
  } else {
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
  console.log("✓ auth callback handles code/error query payload routes");

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
