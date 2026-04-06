#!/usr/bin/env node

import fs from "fs";
import path from "path";

const args = new Set(process.argv.slice(2));

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
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

function escapeRegex(raw) {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toFilePosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkFiles(baseDir, acceptedExtensions, out = []) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkFiles(fullPath, acceptedExtensions, out);
      continue;
    }
    if (!acceptedExtensions.has(path.extname(entry.name))) continue;
    out.push(fullPath);
  }
  return out;
}

function extractIndexReference(lint) {
  const detail = String(lint?.detail || "");
  const normalizedDetail = detail.replace(/\\`/g, "`");
  const regex =
    /index\s+`?([a-zA-Z0-9_.-]+)`?\s+on\s+table\s+`?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)`?/i;
  const match = normalizedDetail.match(regex);
  if (!match) {
    return {
      cacheKey: String(lint?.cache_key || ""),
      index: "",
      schema: String(lint?.metadata?.schema || ""),
      table: String(lint?.metadata?.name || ""),
      detail: normalizedDetail,
    };
  }

  return {
    cacheKey: String(lint?.cache_key || ""),
    index: match[1],
    schema: match[2],
    table: match[3],
    detail: normalizedDetail,
  };
}

const KNOWN_INDEX_COLUMNS = {
  idx_bead_transactions_created_at: ["created_at"],
  idx_bead_transactions_user_id: ["user_id"],
  bead_transactions_thread_id_idx: ["thread_id"],
  idx_image_thread_id: ["thread_id"],
  idx_keywords_keyword: ["keyword"],
  idx_messages_created_at: ["created_at"],
  messages_thread_turn_id_idx: ["thread_id", "turn", "id"],
  idx_payment_history_created_at: ["created_at"],
  idx_payment_history_status: ["status"],
  idx_payment_history_user_id: ["user_id"],
  payment_history_user_created_at_idx: ["user_id", "created_at"],
  idx_user_activity_logs_created_at: ["created_at"],
  idx_user_activity_logs_user_id: ["user_id"],
  user_activity_logs_action_created_at_idx: ["action", "created_at"],
  user_activity_logs_user_action_created_at_idx: [
    "user_id",
    "action",
    "created_at",
  ],
  payment_webhook_transmissions_created_at_idx: ["created_at"],
};

function mergeColumnTokens(tokens) {
  const merged = [];
  let index = 0;
  while (index < tokens.length) {
    const current = tokens[index];
    const next = tokens[index + 1];
    if (
      next &&
      [
        "user_id",
        "thread_id",
        "order_id",
        "payment_key",
        "bead_quantity",
        "created_at",
        "updated_at",
        "event_type",
        "retried_count",
        "transmission_id",
        "transmission_time",
      ].includes(`${current}_${next}`)
    ) {
      merged.push(`${current}_${next}`);
      index += 2;
      continue;
    }

    merged.push(current);
    index += 1;
  }

  return merged;
}

function inferColumnsFromIndexName(indexName, tableName) {
  if (KNOWN_INDEX_COLUMNS[indexName]) {
    return KNOWN_INDEX_COLUMNS[indexName];
  }

  let normalized = indexName;
  normalized = normalized.replace(new RegExp(`^idx_${escapeRegex(tableName)}_`), "");
  normalized = normalized.replace(new RegExp(`^${escapeRegex(tableName)}_`), "");
  normalized = normalized.replace(/_idx$/, "");

  const rawTokens = normalized.split("_").filter(Boolean);
  if (rawTokens.length === 0) {
    return [];
  }

  const merged = mergeColumnTokens(rawTokens);
  return merged.length > 0 ? merged : [];
}

function collectUsageSignals(files, tables, columnsByTable) {
  const signals = new Map();

  function getSignal(table) {
    if (!signals.has(table)) {
      signals.set(table, {
        tableHits: 0,
        tableFiles: new Set(),
        columnHits: new Map(),
      });
    }
    return signals.get(table);
  }

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, "utf8");
    const isSqlFile = filePath.endsWith(".sql");
    const relative = toFilePosixPath(path.relative(process.cwd(), filePath));

    tables.forEach(table => {
      const tableRegex = new RegExp(
        `(from\\(\\s*["'\`]${escapeRegex(table)}["'\`]\\)|public\\.${escapeRegex(table)}\\b|\\b${escapeRegex(table)}\\b)`,
        "i",
      );
      if (!tableRegex.test(content)) return;

      const signal = getSignal(table);
      signal.tableHits += 1;
      signal.tableFiles.add(relative);

      const columns = columnsByTable.get(table) || [];
      columns.forEach(column => {
        const apiRegex = new RegExp(
          `\\.(eq|neq|gt|gte|lt|lte|in|order)\\(\\s*["'\`]${escapeRegex(column)}["'\`]`,
          "g",
        );
        const sqlRegex = new RegExp(`\\b${escapeRegex(column)}\\b`, "g");

        const apiMatches = content.match(apiRegex);
        const sqlMatches = isSqlFile ? content.match(sqlRegex) : null;
        const hits = (apiMatches?.length || 0) + (sqlMatches?.length || 0);
        if (hits <= 0) return;

        const current = signal.columnHits.get(column) || {
          hits: 0,
          files: new Set(),
        };
        current.hits += hits;
        current.files.add(relative);
        signal.columnHits.set(column, current);
      });
    });
  });

  return signals;
}

function startsWithColumns(columns, prefixColumns) {
  if (prefixColumns.length >= columns.length) return false;
  for (let i = 0; i < prefixColumns.length; i += 1) {
    if (columns[i] !== prefixColumns[i]) return false;
  }
  return true;
}

function classifyIndexes(indexRows, signals) {
  const byTable = new Map();
  indexRows.forEach(row => {
    if (!byTable.has(row.table)) byTable.set(row.table, []);
    byTable.get(row.table).push(row);
  });

  return indexRows.map(row => {
    const siblings = byTable.get(row.table) || [];
    const coveringIndexes = siblings.filter(candidate =>
      startsWithColumns(candidate.columns, row.columns),
    );
    const signal = signals.get(row.table);
    const leadingColumn = row.columns[0] || "";
    const leadingColumnHits =
      leadingColumn && signal?.columnHits.get(leadingColumn)
        ? signal.columnHits.get(leadingColumn).hits
        : 0;
    const allColumnsObserved =
      row.columns.length > 0 &&
      row.columns.every(column => (signal?.columnHits.get(column)?.hits || 0) > 0);
    const tableReferenced = (signal?.tableHits || 0) > 0;

    let classification = "review";
    let reason = "쿼리 패턴 근거가 부족해 수동 검토가 필요합니다.";
    let confidence = "low";

    if (coveringIndexes.length > 0 && leadingColumnHits > 0) {
      classification = "drop_candidate";
      confidence = allColumnsObserved ? "high" : "medium";
      reason = `동일 테이블에서 선두 컬럼이 같은 확장 인덱스(${coveringIndexes
        .map(item => item.index)
        .join(", ")})가 있어 중복 가능성이 높습니다.`;
    } else if (allColumnsObserved || leadingColumnHits > 0) {
      classification = "keep_candidate";
      confidence = allColumnsObserved ? "high" : "medium";
      reason = "코드/SQL에서 관련 컬럼 접근 패턴이 관찰되어 유지 가능성이 높습니다.";
    } else if (!tableReferenced) {
      classification = "review";
      confidence = "low";
      reason = "코드베이스에서 테이블 참조 자체가 거의 보이지 않아 운영 실제 사용량 확인이 필요합니다.";
    }

    return {
      ...row,
      classification,
      confidence,
      reason,
      coveringIndexes: coveringIndexes.map(item => item.index),
      signal: {
        tableHits: signal?.tableHits || 0,
        leadingColumnHits,
        allColumnsObserved,
      },
    };
  });
}

function renderMarkdownReport(rows, metadata) {
  const summary = {
    dropCandidate: rows.filter(row => row.classification === "drop_candidate")
      .length,
    keepCandidate: rows.filter(row => row.classification === "keep_candidate")
      .length,
    review: rows.filter(row => row.classification === "review").length,
  };

  const lines = [];
  lines.push("# Supabase Unused Index Report");
  lines.push("");
  lines.push(`- project_ref: ${metadata.projectRef || "(unknown)"}`);
  lines.push(`- unresolved_unused_indexes: ${rows.length}`);
  lines.push(`- drop_candidate: ${summary.dropCandidate}`);
  lines.push(`- keep_candidate: ${summary.keepCandidate}`);
  lines.push(`- review: ${summary.review}`);
  lines.push("");
  lines.push(
    "| table | index | columns | classification | confidence | reason |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- |");

  rows.forEach(row => {
    lines.push(
      `| ${row.table} | ${row.index} | ${row.columns.join(", ")} | ${row.classification} | ${row.confidence} | ${row.reason.replace(/\|/g, "\\|")} |`,
    );
  });

  lines.push("");
  lines.push("## Notes");
  lines.push(
    "- 이 리포트는 Supabase advisor 결과와 코드베이스 정적 패턴 기반의 자동 분류입니다.",
  );
  lines.push("- 실제 삭제 전에는 `EXPLAIN ANALYZE`와 운영 트래픽 구간 재확인이 필요합니다.");
  lines.push(
    "- `drop_candidate`는 자동 삭제되지 않으며, 수동 마이그레이션으로만 정리해야 합니다.",
  );

  return lines.join("\n");
}

async function main() {
  const outputJson = args.has("--json");
  const outputFileArg = readArgValue("--output-file");
  const outputFile =
    outputFileArg || "reports/supabase-unused-indexes-report.md";

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
  const projectRef =
    readEnv("SUPABASE_PROJECT_REF") || inferProjectRefFromUrl(supabaseUrl);

  console.log("HODAM Supabase unused-index report");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );

  if (!accessToken || !projectRef) {
    console.error(
      "Missing SUPABASE_ACCESS_TOKEN and/or SUPABASE_PROJECT_REF (project ref can be inferred from NEXT_PUBLIC_SUPABASE_URL).",
    );
    process.exit(1);
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
    console.error(
      `advisors/performance request failed (${response.status}): ${rawText.slice(0, 400)}`,
    );
    process.exit(1);
  }

  const lints = toArray(parsed?.result?.lints || parsed?.lints || parsed);
  const unresolvedRows = lints
    .filter(lint => String(lint?.name || "") === "unused_index")
    .map(extractIndexReference)
    .filter(row => row.table && row.index)
    .map(row => ({
      ...row,
      columns: inferColumnsFromIndexName(row.index, row.table),
    }));

  const columnsByTable = new Map();
  unresolvedRows.forEach(row => {
    if (!columnsByTable.has(row.table)) columnsByTable.set(row.table, new Set());
    row.columns.forEach(column => columnsByTable.get(row.table).add(column));
  });

  const normalizedColumnsByTable = new Map(
    Array.from(columnsByTable.entries()).map(([table, set]) => [
      table,
      Array.from(set),
    ]),
  );

  const files = [
    ...walkFiles(
      path.join(process.cwd(), "src"),
      new Set([".ts", ".tsx", ".js", ".jsx", ".sql"]),
    ),
    ...walkFiles(path.join(process.cwd(), "scripts"), new Set([".mjs", ".js"])),
    ...walkFiles(path.join(process.cwd(), "supabase", "migrations"), new Set([".sql"])),
  ];

  const signals = collectUsageSignals(
    files,
    Array.from(normalizedColumnsByTable.keys()),
    normalizedColumnsByTable,
  );

  const classified = classifyIndexes(unresolvedRows, signals);
  const markdown = renderMarkdownReport(classified, { projectRef });

  const outputFullPath = path.join(process.cwd(), outputFile);
  fs.mkdirSync(path.dirname(outputFullPath), { recursive: true });
  fs.writeFileSync(outputFullPath, markdown, "utf8");

  console.log(`- unresolved unused indexes: ${classified.length}`);
  console.log(`- output file: ${outputFile}`);
  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          projectRef,
          rows: classified,
        },
        null,
        2,
      ),
    );
  }

  console.log("Supabase unused-index report generated.");
}

main().catch(error => {
  console.error(
    "Supabase unused-index report failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
