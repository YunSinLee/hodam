#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";
import {
  isWithinLookback,
  parsePositiveInt,
  summarizeCoverageRows,
  toRetryTotal,
} from "./lib/payments-webhook-coverage-utils.mjs";

const args = new Set(process.argv.slice(2));
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

function readArgValue(prefix, fallback = "") {
  const raw = process.argv.find(arg => arg.startsWith(`${prefix}=`));
  if (!raw) return fallback;
  return raw.slice(prefix.length + 1).trim() || fallback;
}

function resolveAccessToken(explicitToken) {
  if (explicitToken) {
    return {
      token: explicitToken,
      source: "provided",
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

function toIsoTime(value) {
  const parsed = Date.parse(value || "");
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function resolveOutputPath(filePath) {
  if (!filePath) return "";
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(process.cwd(), filePath);
}

function writeReportFile(reportFile, content) {
  if (!reportFile) return;
  const fullPath = resolveOutputPath(reportFile);
  if (!fullPath) return;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function renderMarkdownReport(report) {
  const lines = [
    "# Payments Webhook Coverage Report",
    "",
    `- generated_at: ${report.generatedAt}`,
    `- status: ${report.status}`,
    `- node_env: ${report.nodeEnv}`,
    `- loaded_env_files: ${
      report.loadedFiles.length > 0 ? report.loadedFiles.join(", ") : "(none)"
    }`,
    `- lookback_minutes: ${report.lookbackMinutes}`,
    `- max_orders: ${report.maxOrders}`,
    `- strict_mode: ${report.strictMode}`,
    `- require_completed: ${report.requireCompleted}`,
    `- checked_orders: ${report.rows.length}`,
    `- webhook_events_total: ${report.totalWebhookEvents}`,
    `- retry_total: ${report.totalRetryCount}`,
    `- missing_orders: ${report.missingOrders.length}`,
  ];

  if (report.failureReason) {
    lines.push(`- failure_reason: ${report.failureReason}`);
  }

  lines.push("", "## Checked Orders", "");

  if (report.rows.length === 0) {
    lines.push("(none)");
  } else {
    lines.push(
      "| order_id | completed_at | webhook_events | retry_total |",
      "| --- | --- | ---: | ---: |",
    );
    report.rows.forEach(row => {
      lines.push(
        `| ${row.orderId} | ${row.completedAt} | ${row.webhookEvents} | ${row.retryTotal} |`,
      );
    });
  }

  lines.push("", "## Missing Webhook Orders", "");
  if (report.missingOrders.length === 0) {
    lines.push("(none)");
  } else {
    report.missingOrders.forEach(orderId => {
      lines.push(`- ${orderId}`);
    });
  }

  lines.push("");
  return lines.join("\n");
}

async function main() {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const explicitAccessToken = readArgValue(
    "--access-token",
    readEnv("HODAM_TEST_ACCESS_TOKEN"),
  );
  const accessTokenResult = resolveAccessToken(explicitAccessToken);
  const accessToken = accessTokenResult.token;

  const lookbackMinutes = parsePositiveInt(
    readArgValue("--lookback-minutes", "180"),
    180,
  );
  const maxOrders = parsePositiveInt(readArgValue("--max-orders", "10"), 10);
  const strictMode = args.has("--strict");
  const requireCompleted = args.has("--require-completed");
  const reportFile = readArgValue("--report-file", "");

  const report = {
    generatedAt: new Date().toISOString(),
    nodeEnv,
    loadedFiles,
    lookbackMinutes,
    maxOrders,
    strictMode,
    requireCompleted,
    status: "running",
    failureReason: "",
    rows: [],
    missingOrders: [],
    totalWebhookEvents: 0,
    totalRetryCount: 0,
  };

  function finish(exitCode) {
    report.status = exitCode === 0 ? "passed" : "failed";
    writeReportFile(reportFile, renderMarkdownReport(report));
    process.exit(exitCode);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const message = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY";
    report.failureReason = message;
    console.error(message);
    return finish(1);
  }

  if (!accessToken) {
    const message = `Missing HODAM_TEST_ACCESS_TOKEN (or --access-token). ${accessTokenResult.reason || ""}`.trim();
    report.failureReason = message;
    console.error(message);
    return finish(1);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  console.log("HODAM payments webhook coverage check");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );
  console.log(`- lookback minutes: ${lookbackMinutes}`);
  console.log(`- max orders: ${maxOrders}`);
  console.log(`- strict mode: ${strictMode}`);
  console.log(`- require completed: ${requireCompleted}`);
  console.log(`- token source: ${accessTokenResult.source}`);

  const { data: payments, error: paymentsError } = await client
    .from("payment_history")
    .select(
      "order_id, status, amount, bead_quantity, created_at, completed_at, payment_key",
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(maxOrders);

  if (paymentsError) {
    const message = `Failed to query payment_history: ${paymentsError.message}`;
    report.failureReason = message;
    console.error(message);
    return finish(1);
  }

  const candidatePayments = (payments || []).filter(payment =>
    isWithinLookback(
      payment.completed_at || payment.created_at,
      lookbackMinutes,
    ),
  );

  if (candidatePayments.length === 0) {
    const message =
      "No completed payments found in lookback window (nothing to verify).";
    if (requireCompleted || strictMode) {
      report.failureReason = message;
      console.error(message);
      return finish(1);
    }
    console.log(message);
    return finish(0);
  }

  for (const payment of candidatePayments) {
    const orderId = String(payment.order_id || "").trim();
    if (!orderId) continue;

    const { data: transmissions, error: transmissionError } = await client.rpc(
      "get_payment_webhook_transmissions",
      {
        p_order_id: orderId,
      },
    );

    if (transmissionError) {
      const message = `Failed to query webhook transmissions for ${orderId}: ${transmissionError.message}`;
      report.failureReason = message;
      console.error(message);
      return finish(1);
    }

    const transmissionRows = Array.isArray(transmissions) ? transmissions : [];
    const transmissionCount = transmissionRows.length;
    const retryCount = toRetryTotal(transmissionRows);

    const completedAt = toIsoTime(payment.completed_at || payment.created_at);
    report.rows.push({
      orderId,
      completedAt: completedAt || "unknown",
      webhookEvents: transmissionCount,
      retryTotal: retryCount,
    });
    console.log(
      `- order=${orderId} completed_at=${completedAt || "unknown"} webhook_events=${transmissionCount} retry_total=${retryCount}`,
    );
  }

  const summary = summarizeCoverageRows(report.rows);
  report.totalWebhookEvents = summary.totalWebhookEvents;
  report.totalRetryCount = summary.totalRetryCount;
  report.missingOrders = summary.missingOrders;

  console.log("");
  console.log(
    `Summary: checked=${candidatePayments.length} webhook_events=${report.totalWebhookEvents} retry_total=${report.totalRetryCount} missing=${report.missingOrders.length}`,
  );

  if (report.missingOrders.length > 0) {
    console.log(`- missing orders: ${report.missingOrders.join(", ")}`);
    if (strictMode) {
      report.failureReason = "Missing webhook transmissions detected";
      return finish(1);
    }
  }

  console.log("Payments webhook coverage check passed.");
  return finish(0);
}

await main();
