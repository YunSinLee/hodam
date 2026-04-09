#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

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

function readBaselineFile(filePath) {
  if (!filePath) {
    return {
      ignoredIndexNames: new Set(),
      ignoredCacheKeys: new Set(),
      loadedPath: "",
    };
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Baseline file not found: ${filePath}`);
  }

  const parsed = safeJsonParse(fs.readFileSync(resolvedPath, "utf8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid baseline JSON: ${filePath}`);
  }

  const toSet = value => {
    if (!Array.isArray(value)) return new Set();
    return new Set(
      value
        .map(item => String(item || "").trim())
        .filter(Boolean),
    );
  };

  return {
    ignoredIndexNames: toSet(parsed.allowIndexNames),
    ignoredCacheKeys: toSet(parsed.allowCacheKeys),
    ignoredForeignKeyCacheKeys: toSet(parsed.allowForeignKeyCacheKeys),
    loadedPath: filePath,
  };
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
  const ignoredForeignKeyCacheKeys = new Set([
    ...parseCsvValues(
      readEnv("HODAM_SUPABASE_PERFORMANCE_IGNORE_FOREIGN_KEYS"),
    ),
    ...parseCsvValues(readArgValue("--ignore-foreign-key-cache-keys")),
  ]);
  const baselineFile =
    readArgValue("--baseline-file") ||
    readEnv("HODAM_SUPABASE_PERFORMANCE_BASELINE_FILE");
  const baseline = readBaselineFile(baselineFile);
  baseline.ignoredIndexNames.forEach(indexName => {
    ignoredIndexNames.add(indexName);
  });
  baseline.ignoredCacheKeys.forEach(cacheKey => {
    ignoredCacheKeys.add(cacheKey);
  });
  baseline.ignoredForeignKeyCacheKeys.forEach(cacheKey => {
    ignoredForeignKeyCacheKeys.add(cacheKey);
  });
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
  if (ignoredForeignKeyCacheKeys.size > 0) {
    console.log(
      `- ignored foreign-key cache keys: ${Array.from(ignoredForeignKeyCacheKeys).join(", ")}`,
    );
  }
  if (baseline.loadedPath) {
    console.log(`- baseline file: ${baseline.loadedPath}`);
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
  const unindexedForeignKeyLints = lints.filter(
    lint => String(lint?.name || "") === "unindexed_foreign_keys",
  );

  const unresolved = [];
  const ignored = [];
  const unresolvedForeignKeys = [];
  const ignoredForeignKeys = [];

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

  unindexedForeignKeyLints.forEach(lint => {
    const cacheKey = String(lint?.cache_key || "");
    const schema = String(lint?.metadata?.schema || "");
    const table = String(lint?.metadata?.name || "");
    const foreignKeyName = String(lint?.metadata?.fkey_name || "");
    const detail = String(lint?.detail || lint?.description || "");
    const normalized = {
      cacheKey,
      schema,
      table,
      foreignKeyName,
      detail,
    };
    if (cacheKey && ignoredForeignKeyCacheKeys.has(cacheKey)) {
      ignoredForeignKeys.push(normalized);
      return;
    }
    unresolvedForeignKeys.push(normalized);
  });

  console.log(`- advisor lints total: ${lints.length}`);
  console.log(`- unused index lints: ${unusedIndexLints.length}`);
  console.log(`- ignored unused index lints: ${ignored.length}`);
  console.log(`- unresolved unused index lints: ${unresolved.length}`);
  console.log(`- unindexed foreign-key lints: ${unindexedForeignKeyLints.length}`);
  console.log(`- ignored unindexed foreign-key lints: ${ignoredForeignKeys.length}`);
  console.log(
    `- unresolved unindexed foreign-key lints: ${unresolvedForeignKeys.length}`,
  );

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

  if (ignoredForeignKeys.length > 0) {
    console.log("\nIgnored unindexed-foreign-key lints:");
    ignoredForeignKeys.forEach(item => {
      const location =
        item.schema && item.table ? `${item.schema}.${item.table}` : "unknown";
      console.log(
        `- ✓ ${location}.${item.foreignKeyName || "foreign_key"} (ignored)`,
      );
    });
  }

  if (unresolvedForeignKeys.length > 0) {
    console.log("\nUnresolved unindexed-foreign-key lints:");
    unresolvedForeignKeys.forEach(item => {
      const location =
        item.schema && item.table ? `${item.schema}.${item.table}` : "unknown";
      console.log(
        `- ! ${location}.${item.foreignKeyName || "foreign_key"}: ${normalizeText(item.detail)}`,
      );
    });
  } else {
    console.log("\nNo unresolved unindexed-foreign-key lints.");
  }

  if (strictMode && unresolved.length > maxUnusedIndexes) {
    console.error(
      `\nSupabase performance advisor check failed: unresolved unused indexes ${unresolved.length} > allowed ${maxUnusedIndexes}.`,
    );
    process.exit(1);
  }

  if (strictMode && unresolvedForeignKeys.length > 0) {
    console.error(
      `\nSupabase performance advisor check failed: unresolved unindexed foreign keys ${unresolvedForeignKeys.length} > allowed 0.`,
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
