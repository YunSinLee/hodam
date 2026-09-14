#!/usr/bin/env node

import { spawnSync } from "child_process";
import path from "path";

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV || "development";
const { merged: localEnv, loaded: loadedFilePaths } = loadLocalEnv({
  cwd,
  nodeEnv,
});
const loadedFiles = loadedFilePaths.map(fullPath => path.basename(fullPath));

function readEnv(name) {
  return readEnvValue(name, {
    processEnv: process.env,
    fileEnv: localEnv,
  });
}

function parseLimit() {
  const raw = process.argv.find(arg => arg.startsWith("--limit="));
  if (!raw) return 14;
  const parsed = Number(raw.slice("--limit=".length).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 14;
  return Math.min(parsed, 90);
}

function parseRequireAuthCallbackMetricsFlag() {
  return process.argv.includes("--require-auth-callback-metrics");
}

function parseRequireAuthCallbackProviderMetricsFlag() {
  return process.argv.includes("--require-auth-callback-provider-metrics");
}

function resolveAccessToken() {
  const explicit = readEnv("HODAM_TEST_ACCESS_TOKEN");
  if (explicit) {
    return { token: explicit, source: "env:HODAM_TEST_ACCESS_TOKEN", reason: "" };
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

  if (resolved.status === 0) {
    const token = (resolved.stdout || "").trim();
    if (token) {
      return { token, source: "script:get-test-access-token", reason: "" };
    }
  }

  const fallbackPat = readEnv("SUPABASE_ACCESS_TOKEN");
  if (fallbackPat) {
    const detail =
      (resolved.stderr || resolved.stdout || "").trim() || "token resolver failed";
    return {
      token: fallbackPat,
      source: "env:SUPABASE_ACCESS_TOKEN",
      reason: detail,
    };
  }

  const reason =
    (resolved.stderr || resolved.stdout || "").trim() || "token unavailable";
  return { token: "", source: "none", reason };
}

function formatError(error) {
  if (!error) return "unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const record = error;
    const message =
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : "";
    const code =
      typeof record.code === "string" && record.code.trim()
        ? record.code.trim()
        : "";
    const details =
      typeof record.details === "string" && record.details.trim()
        ? record.details.trim()
        : "";
    const hint =
      typeof record.hint === "string" && record.hint.trim()
        ? record.hint.trim()
        : "";

    const parts = [message, code && `code=${code}`, details, hint].filter(
      Boolean,
    );

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return String(error);
}

async function queryView(client, viewName, limit) {
  const { data, error } = await client
    .from(viewName)
    .select("*")
    .order("metric_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    if (
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("column")
    ) {
      const fallback = await client.from(viewName).select("*").limit(limit);
      if (fallback.error) {
        throw fallback.error;
      }
      return fallback.data || [];
    }

    throw error;
  }

  return data || [];
}

async function main() {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const accessTokenResult = resolveAccessToken();
  const accessToken = accessTokenResult.token;
  const limit = parseLimit();
  const requireAuthCallbackMetrics = parseRequireAuthCallbackMetricsFlag();
  const requireAuthCallbackProviderMetrics =
    parseRequireAuthCallbackProviderMetricsFlag();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    process.exit(1);
  }

  if (!accessToken) {
    console.error(
      `Missing access token. ${accessTokenResult.reason || "Set HODAM_TEST_ACCESS_TOKEN or test credentials for token resolver."}`,
    );
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  console.log("HODAM KPI check");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );
  console.log(`- limit: ${limit}`);
  console.log(
    `- require auth callback metrics: ${requireAuthCallbackMetrics ? "yes" : "no"}`,
  );
  console.log(
    `- require auth callback provider metrics: ${requireAuthCallbackProviderMetrics ? "yes" : "no"}`,
  );
  console.log(`- token source: ${accessTokenResult.source}`);
  if (accessTokenResult.reason && accessTokenResult.source !== "none") {
    console.log(`! token resolver warning: ${accessTokenResult.reason}`);
  }

  try {
    const [dailyRows, retentionRows, userRetentionRows] = await Promise.all([
      queryView(client, "kpi_daily", limit),
      queryView(client, "kpi_retention_daily", limit),
      queryView(client, "kpi_user_retention", limit),
    ]);

    console.log("\n[kpi_daily]");
    if (dailyRows.length === 0) {
      console.log("(empty)");
    } else {
      console.table(dailyRows);

      const firstRow = dailyRows[0] || {};
      const hasAuthCallbackMetrics =
        Object.prototype.hasOwnProperty.call(
          firstRow,
          "auth_callback_success",
        ) &&
        Object.prototype.hasOwnProperty.call(firstRow, "auth_callback_error");

      if (!hasAuthCallbackMetrics) {
        const message =
          "kpi_daily rows do not include auth_callback_success/auth_callback_error fields";
        if (requireAuthCallbackMetrics) {
          throw new Error(message);
        }
        console.warn(`! ${message}`);
      }

      const hasAuthCallbackProviderMetrics =
        Object.prototype.hasOwnProperty.call(
          firstRow,
          "auth_callback_success_google",
        ) &&
        Object.prototype.hasOwnProperty.call(
          firstRow,
          "auth_callback_success_kakao",
        ) &&
        Object.prototype.hasOwnProperty.call(
          firstRow,
          "auth_callback_error_google",
        ) &&
        Object.prototype.hasOwnProperty.call(
          firstRow,
          "auth_callback_error_kakao",
        );

      if (!hasAuthCallbackProviderMetrics) {
        const message =
          "kpi_daily rows do not include auth callback provider breakdown fields";
        if (requireAuthCallbackProviderMetrics) {
          throw new Error(message);
        }
        console.warn(`! ${message}`);
      }
    }

    console.log("\n[kpi_retention_daily]");
    if (retentionRows.length === 0) {
      console.log("(empty)");
    } else {
      console.table(retentionRows);
    }

    console.log("\n[kpi_user_retention]");
    if (userRetentionRows.length === 0) {
      console.log("(empty)");
    } else {
      console.table(userRetentionRows);
    }
  } catch (error) {
    const message = formatError(error);
    console.error(`KPI check failed: ${message}`);
    process.exit(1);
  }
}

await main();
