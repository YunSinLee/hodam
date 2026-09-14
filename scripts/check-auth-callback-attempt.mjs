#!/usr/bin/env node

import path from "path";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

function normalizeAttemptId(raw) {
  const normalized = String(raw || "").trim();
  if (!normalized) return "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(normalized)) {
    return "";
  }
  return normalized;
}

function toOrigin(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

async function main() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const cwd = process.cwd();
  const { merged: fileEnv, loaded: loadedFilePaths } = loadLocalEnv({
    cwd,
    nodeEnv,
  });
  const loadedFiles = loadedFilePaths.map(fullPath => path.basename(fullPath));

  const attemptId = normalizeAttemptId(
    readArgValue("--attempt-id") ||
      readEnvValue("HODAM_AUTH_CALLBACK_ATTEMPT_ID", {
        processEnv: process.env,
        fileEnv,
      }),
  );
  const runtimeOriginInput =
    readArgValue("--runtime-origin") ||
    readEnvValue("HODAM_RUNTIME_ORIGIN", {
      processEnv: process.env,
      fileEnv,
    }) ||
    readEnvValue("NEXT_PUBLIC_SITE_URL", {
      processEnv: process.env,
      fileEnv,
    }) ||
    "http://localhost:3000";
  const runtimeOrigin = toOrigin(runtimeOriginInput);
  const limitRaw = Number(readArgValue("--limit") || 20);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(60, Math.max(1, Math.floor(limitRaw)))
    : 20;

  console.log("HODAM auth callback attempt diagnostics");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );

  if (!attemptId) {
    console.error(
      "Failed: missing or invalid attempt ID. Use --attempt-id=<value> (8~128 chars, [A-Za-z0-9._:-]).",
    );
    process.exit(1);
  }
  if (!runtimeOrigin) {
    console.error(`Failed: invalid runtime origin: ${runtimeOriginInput}`);
    process.exit(1);
  }

  const url =
    `${runtimeOrigin}/api/v1/auth/callback/metrics/recent?` +
    new URLSearchParams({
      attemptId,
      limit: String(limit),
    }).toString();

  console.log(`- runtime origin: ${runtimeOrigin}`);
  console.log(`- attempt id: ${attemptId}`);
  console.log(`- limit: ${limit}`);
  console.log("");

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const bodyText = await response.text();

  let payload = null;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || typeof payload !== "object") {
    console.error(`Failed: ${url} -> ${response.status}`);
    console.error(`Body: ${bodyText}`);
    process.exit(1);
  }

  console.log(`✓ response status: ${response.status}`);
  console.log(`- degraded: ${Boolean(payload.degraded)}`);
  console.log(
    `- degraded reason: ${
      typeof payload.degradedReason === "string"
        ? payload.degradedReason
        : "(none)"
    }`,
  );
  console.log(`- truncated: ${Boolean(payload.truncated)}`);

  const events = Array.isArray(payload.events) ? payload.events : [];
  console.log(`- events: ${events.length}`);
  if (events.length === 0) {
    console.log("No events found for this attempt ID.");
    return;
  }

  console.log("");
  console.log("Recent events:");
  events.forEach((event, index) => {
    const stage = String(event?.stage || "unknown");
    const timestampMs = Number(event?.timestampMs || 0);
    const callbackPath = String(event?.callbackPath || "/auth/callback");
    const details =
      event?.details && typeof event.details === "object" ? event.details : {};
    console.log(
      `${index + 1}. ${stage} | timestampMs=${timestampMs} | callbackPath=${callbackPath}`,
    );
    if (Object.keys(details).length > 0) {
      console.log(`   details=${JSON.stringify(details)}`);
    }
  });
}

main().catch(error => {
  console.error(
    "Auth callback attempt diagnostics failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
