#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

function readArgValue(prefix, fallback = "") {
  const raw = process.argv.find(arg => arg.startsWith(`${prefix}=`));
  if (!raw) return fallback;
  return raw.slice(prefix.length + 1).trim() || fallback;
}

const localEnv = loadLocalEnv().merged;

function readEnv(name) {
  return readEnvValue(name, {
    processEnv: process.env,
    fileEnv: localEnv,
  });
}

function inferProjectRefFromUrl(url) {
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    if (!host.endsWith(".supabase.co")) return "";
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
}

function safeJsonParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

async function main() {
  const outputFile = readArgValue(
    "--output-file",
    "config/supabase-performance-baseline.json",
  );
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
  const projectRef =
    readEnv("SUPABASE_PROJECT_REF") || inferProjectRefFromUrl(supabaseUrl);

  if (!accessToken || !projectRef) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN and/or SUPABASE_PROJECT_REF (or NEXT_PUBLIC_SUPABASE_URL).",
    );
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/advisors/performance`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const rawText = await response.text();
  const parsed = safeJsonParse(rawText);

  if (!response.ok) {
    throw new Error(
      `advisors/performance request failed (${response.status}): ${rawText.slice(0, 300)}`,
    );
  }

  const lints = toArray(parsed?.result?.lints || parsed?.lints || parsed);
  const allowCacheKeys = lints
    .filter(lint => String(lint?.name || "") === "unused_index")
    .map(lint => String(lint?.cache_key || "").trim())
    .filter(Boolean)
    .sort();
  const allowForeignKeyCacheKeys = lints
    .filter(lint => String(lint?.name || "") === "unindexed_foreign_keys")
    .map(lint => String(lint?.cache_key || "").trim())
    .filter(Boolean)
    .sort();

  const payload = {
    allowCacheKeys,
    allowForeignKeyCacheKeys,
    allowIndexNames: [],
  };

  const fullPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(process.cwd(), outputFile);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("HODAM Supabase performance baseline synced");
  console.log(`- project_ref: ${projectRef}`);
  console.log(`- allow_cache_keys: ${allowCacheKeys.length}`);
  console.log(`- allow_foreign_key_cache_keys: ${allowForeignKeyCacheKeys.length}`);
  console.log(`- output_file: ${outputFile}`);
}

main().catch(error => {
  console.error(
    "sync-supabase-performance-baseline failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
