#!/usr/bin/env node

import fs from "fs";
import path from "path";

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict");

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

function parseCsvValues(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(raw, fallback) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

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

function loadLocalEnv() {
  const cwd = process.cwd();
  const nodeEnv = process.env.NODE_ENV || "development";
  const envFilesInOrder = [
    ".env",
    `.env.${nodeEnv}`,
    ".env.local",
    `.env.${nodeEnv}.local`,
  ];

  const merged = {};
  const loadedFiles = [];
  envFilesInOrder.forEach(fileName => {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) return;
    Object.assign(merged, parseEnv(fs.readFileSync(fullPath, "utf8")));
    loadedFiles.push(fileName);
  });

  return { merged, loadedFiles, nodeEnv };
}

const { merged: localEnv, loadedFiles, nodeEnv } = loadLocalEnv();

function readEnv(name) {
  const processValue = process.env[name];
  if (processValue && processValue.trim()) return processValue.trim();
  const localValue = localEnv[name];
  if (localValue && localValue.trim()) return localValue.trim();
  return "";
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

function normalizeText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? "");
}

function extractIndexReference(lint) {
  const detail = String(lint?.detail || "");
  const normalizedDetail = detail.replace(/\\`/g, "`");
  const regex =
    /index\s+`?([a-zA-Z0-9_.-]+)`?\s+on\s+table\s+`?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)`?/i;
  const match = normalizedDetail.match(regex);
  if (!match) {
    return {
      schema: String(lint?.metadata?.schema || ""),
      table: String(lint?.metadata?.name || ""),
      index: "",
    };
  }

  return {
    index: match[1],
    schema: match[2],
    table: match[3],
  };
}

async function main() {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
  const projectRef =
    readEnv("SUPABASE_PROJECT_REF") || inferProjectRefFromUrl(supabaseUrl);
  const ignoredIndexNames = new Set([
    ...parseCsvValues(readEnv("HODAM_SUPABASE_PERFORMANCE_IGNORE_INDEXES")),
    ...parseCsvValues(readArgValue("--ignore-indexes")),
  ]);
  const ignoredCacheKeys = new Set([
    ...parseCsvValues(readEnv("HODAM_SUPABASE_PERFORMANCE_IGNORE_LINTS")),
    ...parseCsvValues(readArgValue("--ignore-cache-keys")),
  ]);
  const maxUnusedIndexes = parsePositiveInteger(
    readArgValue("--max-unused-indexes"),
    0,
  );

  console.log("HODAM Supabase performance advisor check");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );
  console.log(`- strict mode: ${strictMode}`);
  if (ignoredIndexNames.size > 0) {
    console.log(`- ignored index names: ${Array.from(ignoredIndexNames).join(", ")}`);
  }
  if (ignoredCacheKeys.size > 0) {
    console.log(`- ignored cache keys: ${Array.from(ignoredCacheKeys).join(", ")}`);
  }

  if (!accessToken || !projectRef) {
    const message =
      "Missing SUPABASE_ACCESS_TOKEN and/or SUPABASE_PROJECT_REF (project ref can be inferred from NEXT_PUBLIC_SUPABASE_URL).";
    if (strictMode) {
      console.error(`✗ ${message}`);
      process.exit(1);
    }
    console.warn(`! ${message}`);
    console.warn("Supabase performance advisor check skipped.");
    return;
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
    const message = `advisors/performance request failed (${response.status}): ${rawText.slice(0, 400)}`;
    if (strictMode) {
      console.error(`✗ ${message}`);
      process.exit(1);
    }
    console.warn(`! ${message}`);
    return;
  }

  const lints = toArray(parsed?.result?.lints || parsed?.lints || parsed);
  const unusedIndexLints = lints.filter(
    lint => String(lint?.name || "") === "unused_index",
  );

  const unresolved = [];
  const ignored = [];

  unusedIndexLints.forEach(lint => {
    const cacheKey = String(lint?.cache_key || "");
    const { schema, table, index } = extractIndexReference(lint);
    const isIgnored =
      (index && ignoredIndexNames.has(index)) ||
      (cacheKey && ignoredCacheKeys.has(cacheKey));
    const normalized = {
      cacheKey,
      schema: schema || String(lint?.metadata?.schema || ""),
      table: table || String(lint?.metadata?.name || ""),
      index,
      detail: String(lint?.detail || lint?.description || ""),
    };

    if (isIgnored) {
      ignored.push(normalized);
      return;
    }

    unresolved.push(normalized);
  });

  console.log(`- advisor lints total: ${lints.length}`);
  console.log(`- unused index lints: ${unusedIndexLints.length}`);
  console.log(`- ignored unused index lints: ${ignored.length}`);
  console.log(`- unresolved unused index lints: ${unresolved.length}`);

  if (ignored.length > 0) {
    console.log("\nIgnored unused-index lints:");
    ignored.forEach(item => {
      const location =
        item.schema && item.table ? `${item.schema}.${item.table}` : "unknown";
      const indexLabel = item.index || "unknown_index";
      console.log(`- ✓ ${location}.${indexLabel} (ignored)`);
    });
  }

  if (unresolved.length > 0) {
    console.log("\nUnresolved unused-index lints:");
    unresolved.forEach(item => {
      const location =
        item.schema && item.table ? `${item.schema}.${item.table}` : "unknown";
      const indexLabel = item.index || "unknown_index";
      const detail = normalizeText(item.detail);
      console.log(`- ! ${location}.${indexLabel}: ${detail}`);
    });
  } else {
    console.log("\nNo unresolved unused-index lints.");
  }

  if (strictMode && unresolved.length > maxUnusedIndexes) {
    console.error(
      `\nSupabase performance advisor check failed: unresolved unused indexes ${unresolved.length} > allowed ${maxUnusedIndexes}.`,
    );
    process.exit(1);
  }

  console.log("\nSupabase performance advisor check passed.");
}

main().catch(error => {
  console.error(
    "Supabase performance advisor check failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
