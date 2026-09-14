#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function readArgValue(prefix, fallback = "") {
  const raw = process.argv.find(arg => arg.startsWith(`${prefix}=`));
  if (!raw) return fallback;
  return raw.slice(prefix.length + 1).trim() || fallback;
}

function readArgFlag(flag) {
  return process.argv.includes(flag);
}

function toPositiveInt(raw, fallback) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function toPositiveFloatOrNull(raw) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toNonNegativeIntOrNull(raw) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function parseListArg(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

function toTimestampOrNull(raw) {
  const parsed = Date.parse(String(raw || ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function resolveOutputPath(filePath) {
  if (!filePath) return "";
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(process.cwd(), filePath);
}

function renderMarkdownReport({
  generatedAt,
  limit,
  branch,
  repo,
  maxAgeHours,
  includeResolvedFailures,
  ignoreShaPrefixes,
  scannedRunCount,
  failedRunCount,
  skippedResolvedFailuresCount,
  rows,
  noJobsStartedRows,
}) {
  const lines = [
    "# GitHub Failed Runs Report",
    "",
    `- generated_at: ${generatedAt}`,
    `- scanned_runs: ${scannedRunCount}`,
    `- failed_runs_total: ${failedRunCount}`,
    `- failed_runs_in_report: ${rows.length}`,
    `- no_jobs_started_count: ${noJobsStartedRows.length}`,
    `- skipped_resolved_failures: ${skippedResolvedFailuresCount}`,
    `- limit: ${limit}`,
    `- include_resolved_failures: ${includeResolvedFailures}`,
  ];

  if (branch) lines.push(`- branch: ${branch}`);
  if (repo) lines.push(`- repo: ${repo}`);
  if (maxAgeHours) lines.push(`- max_age_hours: ${maxAgeHours}`);
  if (ignoreShaPrefixes.length > 0) {
    lines.push(`- ignore_sha_prefixes: ${ignoreShaPrefixes.join(", ")}`);
  }

  lines.push("", "## Failed Runs", "");
  if (rows.length === 0) {
    lines.push("(none)");
  } else {
    lines.push(
      "| workflow | run_id | branch | sha | cause | url |",
      "| --- | ---: | --- | --- | --- | --- |",
    );
    rows.forEach(row => {
      lines.push(
        `| ${row.workflowName} | ${row.runId} | ${row.branch || "-"} | ${(row.sha || "").slice(0, 12)} | ${row.probableCause} | ${row.url} |`,
      );
    });
  }

  lines.push("", "## No Jobs Started", "");
  if (noJobsStartedRows.length === 0) {
    lines.push("(none)");
  } else {
    noJobsStartedRows.forEach(row => {
      lines.push(
        `- ${row.workflowName} #${row.runId} (${row.branch || "-"}) ${row.url}`,
      );
    });
  }

  lines.push("");
  return lines.join("\n");
}

function writeReportFile(reportFile, content) {
  if (!reportFile) return;
  const fullPath = resolveOutputPath(reportFile);
  if (!fullPath) return;
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function runGhJson(args) {
  const output = execSync(`gh ${args}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const parsed = safeJsonParse(output);
  if (!parsed) {
    throw new Error(`Failed to parse gh JSON output for: gh ${args}`);
  }
  return parsed;
}

function hasGhCli() {
  try {
    execSync("gh --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasGhAuth() {
  if ((process.env.GH_TOKEN || "").trim()) {
    return true;
  }
  if ((process.env.GITHUB_TOKEN || "").trim()) {
    return true;
  }

  try {
    execSync("gh auth status", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isFailedConclusion(conclusion) {
  const normalized = String(conclusion || "").toLowerCase();
  return (
    normalized === "failure" ||
    normalized === "timed_out" ||
    normalized === "startup_failure" ||
    normalized === "action_required"
  );
}

function summarizeFailedJobs(jobs) {
  const failedJobs = jobs.filter(job => isFailedConclusion(job?.conclusion));
  if (failedJobs.length === 0) {
    return {
      failedJobCount: 0,
      failedStepCount: 0,
      details: [],
    };
  }

  const details = failedJobs.map(job => {
    const failedSteps = Array.isArray(job?.steps)
      ? job.steps.filter(step => isFailedConclusion(step?.conclusion))
      : [];
    return {
      name: String(job?.name || "(unknown job)"),
      conclusion: String(job?.conclusion || ""),
      failedSteps: failedSteps.map(step => String(step?.name || "(unknown step)")),
      url: String(job?.url || ""),
    };
  });

  return {
    failedJobCount: failedJobs.length,
    failedStepCount: details.reduce((acc, job) => acc + job.failedSteps.length, 0),
    details,
  };
}

function main() {
  const limit = toPositiveInt(readArgValue("--limit", "12"), 12);
  const branch = readArgValue("--branch", "");
  const repo = readArgValue("--repo", "");
  const reportFile = readArgValue("--report-file", "");
  const jsonOutput = readArgFlag("--json");
  const failOnNoJobsStarted = readArgFlag("--fail-on-no-jobs-started");
  const maxReportRuns = toNonNegativeIntOrNull(
    readArgValue("--max-report-runs", ""),
  );
  const maxNoJobsStarted = toNonNegativeIntOrNull(
    readArgValue("--max-no-jobs-started", ""),
  );
  const includeResolvedFailures = readArgFlag("--include-resolved-failures");
  const maxAgeHours = toPositiveFloatOrNull(readArgValue("--max-age-hours", ""));
  const ignoreShaPrefixes = parseListArg(
    readArgValue(
      "--ignore-sha-prefixes",
      process.env.HODAM_GITHUB_FAILED_RUN_IGNORE_SHAS || "",
    ),
  );

  console.log("HODAM GitHub failed-runs check");
  console.log(`- limit: ${limit}`);
  if (branch) console.log(`- branch filter: ${branch}`);
  if (repo) console.log(`- repo: ${repo}`);
  if (reportFile) console.log(`- report file: ${reportFile}`);
  if (maxAgeHours) console.log(`- max age hours: ${maxAgeHours}`);
  if (maxReportRuns !== null) {
    console.log(`- max report runs: ${maxReportRuns}`);
  }
  if (maxNoJobsStarted !== null) {
    console.log(`- max no-jobs-started: ${maxNoJobsStarted}`);
  }
  console.log(
    `- include resolved failures: ${includeResolvedFailures ? "yes" : "no"}`,
  );
  if (ignoreShaPrefixes.length > 0) {
    console.log(`- ignore sha prefixes: ${ignoreShaPrefixes.join(", ")}`);
  }

  if (!hasGhCli()) {
    console.error("gh CLI not found. Install GitHub CLI first.");
    process.exit(1);
  }
  if (!hasGhAuth()) {
    console.error("gh auth is not configured. Run `gh auth login` first.");
    process.exit(1);
  }

  const repoArg = repo ? ` --repo ${repo}` : "";
  const branchArg = branch ? ` --branch ${branch}` : "";

  const runsRaw = runGhJson(
    `run list --limit ${limit}${branchArg}${repoArg} --json databaseId,workflowName,displayTitle,headBranch,headSha,status,conclusion,createdAt,updatedAt,url,event`,
  );
  const runs = Array.isArray(runsRaw) ? runsRaw : [];

  const latestSuccessTimestampByWorkflow = new Map();
  runs.forEach(run => {
    const workflowName = String(run?.workflowName || "");
    const status = String(run?.status || "").toLowerCase();
    const conclusion = String(run?.conclusion || "").toLowerCase();
    if (!workflowName || status !== "completed" || conclusion !== "success") {
      return;
    }
    const timestamp =
      toTimestampOrNull(run?.updatedAt) ?? toTimestampOrNull(run?.createdAt);
    if (timestamp === null) {
      return;
    }
    const previous = latestSuccessTimestampByWorkflow.get(workflowName);
    if (!Number.isFinite(previous) || timestamp > previous) {
      latestSuccessTimestampByWorkflow.set(workflowName, timestamp);
    }
  });

  const failedRuns = runs.filter(run => isFailedConclusion(run?.conclusion));

  console.log(`- scanned runs: ${runs.length}`);
  console.log(`- failed runs: ${failedRuns.length}`);

  const reportRowsAll = failedRuns
    .map(run => {
      let jobs = [];
      try {
        const view = runGhJson(
        `run view ${run.databaseId}${repoArg} --json jobs,url,conclusion,status`,
      );
      jobs = Array.isArray(view?.jobs) ? view.jobs : [];
    } catch {
      jobs = [];
    }

    const summary = summarizeFailedJobs(jobs);
    const hasNoJobs = jobs.length === 0;
    const probableCause = hasNoJobs
      ? "no_jobs_started(workflow_file_or_trigger_issue)"
      : summary.failedStepCount > 0
        ? "job_step_failure"
        : summary.failedJobCount > 0
          ? "job_failure_without_step_detail"
          : "unknown_failure";

      return {
        runId: run.databaseId,
        workflowName: String(run.workflowName || ""),
        title: run.displayTitle,
        branch: run.headBranch,
        sha: run.headSha,
        event: run.event,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        url: run.url,
        probableCause,
        failedJobs: summary.details,
      };
    })
    .filter(row => {
      const sha = String(row.sha || "").toLowerCase();
      if (ignoreShaPrefixes.some(prefix => sha.startsWith(prefix))) {
        return false;
      }

      if (
        !includeResolvedFailures &&
        latestSuccessTimestampByWorkflow.has(row.workflowName)
      ) {
        const latestSuccessTs = latestSuccessTimestampByWorkflow.get(
          row.workflowName,
        );
        const rowTimestamp =
          toTimestampOrNull(row.updatedAt) ?? toTimestampOrNull(row.createdAt);
        if (
          Number.isFinite(latestSuccessTs) &&
          rowTimestamp !== null &&
          rowTimestamp <= latestSuccessTs
        ) {
          return false;
        }
      }

      if (!maxAgeHours) {
        return true;
      }

      const createdAtMs = toTimestampOrNull(row.createdAt);
      if (createdAtMs === null) {
        return true;
      }
      const ageHours = (Date.now() - createdAtMs) / (1000 * 60 * 60);
      return ageHours <= maxAgeHours;
    });

  const skippedResolvedFailuresCount = Math.max(
    0,
    failedRuns.length - reportRowsAll.length,
  );
  if (!includeResolvedFailures && skippedResolvedFailuresCount > 0) {
    console.log(`- skipped resolved failures: ${skippedResolvedFailuresCount}`);
  }

  const reportRows = reportRowsAll;

  const noJobsStartedRows = reportRows.filter(
    row => row.probableCause === "no_jobs_started(workflow_file_or_trigger_issue)",
  );

  writeReportFile(
    reportFile,
    renderMarkdownReport({
      generatedAt: new Date().toISOString(),
      limit,
      branch,
      repo,
      maxAgeHours,
      includeResolvedFailures,
      ignoreShaPrefixes,
      scannedRunCount: runs.length,
      failedRunCount: failedRuns.length,
      skippedResolvedFailuresCount,
      rows: reportRows,
      noJobsStartedRows,
    }),
  );

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          failedRuns: reportRows,
          noJobsStartedCount: noJobsStartedRows.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (reportRows.length === 0) {
    console.log("No failed runs found in the requested range.");
    return;
  }

  console.log("");
  console.log("Failed runs summary:");
  reportRows.forEach(row => {
    console.log(
      `- ${row.workflowName} #${row.runId} [${row.branch}] ${row.sha?.slice(0, 7) || ""} cause=${row.probableCause}`,
    );
    console.log(`  title: ${row.title}`);
    console.log(`  url: ${row.url}`);
    if (row.failedJobs.length === 0) {
      console.log("  failed_jobs: (none captured)");
      return;
    }
    row.failedJobs.forEach(job => {
      console.log(`  job: ${job.name} (${job.conclusion})`);
      if (job.failedSteps.length > 0) {
        console.log(`    failed_steps: ${job.failedSteps.join(", ")}`);
      } else {
        console.log("    failed_steps: (none captured)");
      }
    });
  });

  if (noJobsStartedRows.length > 0) {
    console.log("");
    console.log(
      `Detected ${noJobsStartedRows.length} no-jobs-started failure(s).`,
    );
    console.log(
      "- Check workflow syntax/trigger filters and ensure at least one unconditional job exists.",
    );
  }

  if (maxReportRuns !== null && reportRows.length > maxReportRuns) {
    console.error(
      `Report failed-runs count ${reportRows.length} exceeded max-report-runs=${maxReportRuns}.`,
    );
    process.exit(1);
  }

  if (maxNoJobsStarted !== null && noJobsStartedRows.length > maxNoJobsStarted) {
    console.error(
      `no-jobs-started count ${noJobsStartedRows.length} exceeded max-no-jobs-started=${maxNoJobsStarted}.`,
    );
    process.exit(1);
  }

  if (failOnNoJobsStarted && noJobsStartedRows.length > 0) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(
    "GitHub failed-runs check failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
