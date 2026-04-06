#!/usr/bin/env node

import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV || "development";
const envFilesInOrder = [
  ".env",
  `.env.${nodeEnv}`,
  ".env.local",
  `.env.${nodeEnv}.local`,
];

function parseEnv(content) {
  const out = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }

  return out;
}

function loadFileEnv() {
  const merged = {};
  const loaded = [];

  for (const fileName of envFilesInOrder) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;
    Object.assign(merged, parseEnv(fs.readFileSync(fullPath, "utf8")));
    loaded.push(fileName);
  }

  return { merged, loaded };
}

const { merged: localEnv, loaded: loadedFiles } = loadFileEnv();

function readEnv(name) {
  const fromProcess = process.env[name];
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  const fromLocal = localEnv[name];
  if (fromLocal && fromLocal.trim()) return fromLocal.trim();
  return "";
}

function parseLimit() {
  const raw = process.argv.find(arg => arg.startsWith("--limit="));
  if (!raw) return 14;
  const parsed = Number(raw.slice("--limit=".length).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 14;
  return Math.min(parsed, 90);
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
  const accessToken =
    readEnv("HODAM_TEST_ACCESS_TOKEN") || readEnv("SUPABASE_ACCESS_TOKEN");
  const limit = parseLimit();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    process.exit(1);
  }

  if (!accessToken) {
    console.error(
      "Missing HODAM_TEST_ACCESS_TOKEN (or SUPABASE_ACCESS_TOKEN fallback).",
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(`KPI check failed: ${message}`);
    process.exit(1);
  }
}

await main();
