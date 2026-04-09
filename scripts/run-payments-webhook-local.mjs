#!/usr/bin/env node

import path from "path";
import { spawnSync } from "child_process";

import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";
import {
  collectWebhookE2EMissingEnv,
  createAccessTokenMeta,
  shouldEnsureTestUser,
} from "./lib/payments-webhook-runner-utils.mjs";

const cwd = process.cwd();
const fileEnv = loadLocalEnv({ cwd }).merged;

function readEnv(name, fallback = "") {
  return readEnvValue(name, {
    processEnv: process.env,
    fileEnv,
    fallback,
  });
}

function resolveAccessTokenForE2E() {
  const explicit = readEnv("HODAM_TEST_ACCESS_TOKEN");
  const resolved = spawnSync(
    process.execPath,
    [path.join("scripts", "get-test-access-token.mjs")],
    {
      cwd,
      env: process.env,
      encoding: "utf8",
    },
  );
  return createAccessTokenMeta({
    explicitToken: explicit,
    scriptStatus: resolved.status || 0,
    scriptStdout: resolved.stdout || "",
    scriptStderr: resolved.stderr || "",
  });
}

function runNodeScript(scriptRelativePath, args = [], env = process.env) {
  return spawnSync(process.execPath, [scriptRelativePath, ...args], {
    cwd,
    env,
    stdio: "inherit",
  });
}

function main() {
  const allowWebhookSkip = readEnv("HODAM_E2E_ALLOW_WEBHOOK_SKIP") === "1";
  const hasServiceRoleKey = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const accessTokenMeta = resolveAccessTokenForE2E();
  const missing = collectWebhookE2EMissingEnv({
    supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    accessToken: accessTokenMeta.token,
    requireServiceRole: !allowWebhookSkip,
    requireAccessToken: !allowWebhookSkip,
  });

  if (missing.length > 0) {
    console.error(
      `Missing required env for webhook e2e: ${missing.join(", ")}`,
    );
    if (accessTokenMeta.reason) {
      console.error(`Token resolution detail: ${accessTokenMeta.reason}`);
    }
    process.exit(1);
  }

  const env = {
    ...process.env,
    HODAM_TEST_PAYMENT_WEBHOOK: "1",
  };
  if (accessTokenMeta.token) {
    env.HODAM_TEST_ACCESS_TOKEN = accessTokenMeta.token;
  }
  if (allowWebhookSkip) {
    env.HODAM_E2E_ALLOW_WEBHOOK_SKIP = "1";
  }

  if (accessTokenMeta.source === "script" && accessTokenMeta.token) {
    console.log("Resolved HODAM_TEST_ACCESS_TOKEN via get-test-access-token.");
  }
  if (accessTokenMeta.source === "script" && !accessTokenMeta.token) {
    console.warn(
      `warn: unable to resolve HODAM_TEST_ACCESS_TOKEN via script (${accessTokenMeta.reason || "unknown reason"}).`,
    );
  }
  if (allowWebhookSkip && !hasServiceRoleKey) {
    console.warn(
      "warn: SUPABASE_SERVICE_ROLE_KEY missing; webhook strict verification will be skipped in optional mode.",
    );
  }
  if (allowWebhookSkip && !accessTokenMeta.token) {
    console.warn(
      "warn: HODAM_TEST_ACCESS_TOKEN missing; running unauthorized payments smoke only in optional mode.",
    );
  }

  if (
    shouldEnsureTestUser({
      email: readEnv("HODAM_TEST_USER_EMAIL"),
      password: readEnv("HODAM_TEST_USER_PASSWORD"),
    })
  ) {
    env.HODAM_E2E_ENSURE_TEST_USER = "1";
  }

  const e2e = runNodeScript(path.join("scripts", "e2e-payments-local.mjs"), [], env);
  if (e2e.status !== 0) {
    process.exit(e2e.status || 1);
  }

  if (allowWebhookSkip && (!hasServiceRoleKey || !accessTokenMeta.token)) {
    console.warn(
      "warn: skipping strict webhook coverage (optional mode prerequisites not met).",
    );
    process.exit(0);
  }

  const coverage = runNodeScript(
    path.join("scripts", "check-payments-webhook-coverage.mjs"),
    [
      "--strict",
      "--require-completed",
      "--lookback-minutes=90",
      "--max-orders=1",
      "--report-file=reports/webhook-coverage.local.md",
    ],
    env,
  );

  process.exit(coverage.status || 0);
}

main();
