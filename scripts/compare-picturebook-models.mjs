#!/usr/bin/env node
// Opt-in comparison of production story/quality logic using synthetic inputs.
// Never imports database/auth clients or makes image-generation requests.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { OpenAI } from "openai";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";
import { evaluation } from "./lib/model-comparison-client.mjs";
import {
  PRICES,
  VARIANTS,
  committedCost,
  isRetryableInfrastructureFailure,
  safeFailure,
  settledComparisonResults,
  summarize,
} from "./lib/model-comparison.mjs";
import { comparisonCases } from "./fixtures/model-comparison-cases.mjs";

const args = process.argv.slice(2);
const flags = new Set(["--run-live", "--dry-run", "--resume", "--help"]);
const values = new Set(["--label", "--limit", "--max-usd"]);
const options = {};
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (flags.has(arg)) options[arg] = true;
  else if (values.has(arg) && args[i + 1] && !args[i + 1].startsWith("--"))
    options[arg] = args[++i];
  else throw new Error(`Unknown or incomplete option: ${arg}`);
}
if (options["--help"] || (!options["--run-live"] && !options["--dry-run"])) {
  console.log(
    "Text-only model comparison (paid API calls require --run-live).\nnode scripts/compare-picturebook-models.mjs --dry-run\nnode scripts/compare-picturebook-models.mjs --run-live --label comparison-2026-10-07 --max-usd 10\nOptional: --limit 2 (pilot), --resume (same label/configuration, retains spend ledger).\nNo images, database writes or production configuration changes.",
  );
  process.exit(0);
}
if (options["--run-live"] && options["--dry-run"])
  throw new Error("Choose dry-run or live");
const label =
  options["--label"] ??
  `comparison-${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("Invalid output label");
const limit = Number(options["--limit"] ?? 24);
const budget = Number(options["--max-usd"] ?? 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 24)
  throw new Error("Limit must be 1–24");
if (!Number.isFinite(budget) || budget <= 0 || budget > 10)
  throw new Error("Budget must be >0 and <=10 USD");

const root = process.cwd();
const out = path.join(root, "reports/local/model-comparisons", label);
const write = async (name, value) => {
  const target = path.join(out, name);
  await fs.writeFile(`${target}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(`${target}.tmp`, target);
};
await fs.mkdir(out, { recursive: true });
const hash = text => createHash("sha256").update(text).digest("hex");
const sourcePath = path.join(root, "src/app/api/langchain.ts");
const source = await fs.readFile(sourcePath, "utf8");
const fixtures = JSON.parse(
  await fs.readFile(
    path.join(root, "scripts/fixtures/picturebook-quality.json"),
    "utf8",
  ),
);
// Interleave ages/modes so a small pilot covers more than one age or mode.
const orderedCases = [...comparisonCases].sort((a, b) => {
  const rank = item =>
    (comparisonCases.indexOf(item) % 4) * 6 +
    ["3-4", "5-7", "8+"].indexOf(item.ageBand) * 2 +
    (item.mode === "adventure" ? 1 : 0);
  return rank(a) - rank(b);
});
const cases = orderedCases.slice(0, limit);
const bundlePath = path.join(out, "pipeline.mjs");
const clientModule = pathToFileURL(
  path.join(root, "scripts/lib/model-comparison-client.mjs"),
).href;
const bundled = await build({
  stdin: {
    contents: `${source}\nexport { reviewCandidateForQuality as qaReview, createModelBudget as qaBudget };`,
    resolveDir: path.dirname(sourcePath),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: bundlePath,
  metafile: true,
  plugins: [
    {
      name: "isolated-model-comparison",
      setup(builder) {
        builder.onResolve(
          { filter: /^server-only$|^\.\/server-auth$/ },
          () => ({ path: "auth", namespace: "comparison" }),
        );
        builder.onResolve({ filter: /^openai$/ }, () => ({
          path: "client",
          namespace: "comparison",
        }));
        builder.onResolve(
          { filter: /\/picturebook\/model-telemetry$/ },
          () => ({ path: "telemetry", namespace: "comparison" }),
        );
        builder.onResolve({ filter: /^file:/ }, item => ({
          path: item.path,
          external: true,
        }));
        builder.onLoad({ filter: /.*/, namespace: "comparison" }, item => ({
          contents:
            item.path === "auth"
              ? "export async function requireServerUser() { return { user: { id: 'synthetic-evaluation' } }; }"
              : item.path === "client"
                ? `export { RecordingOpenAI as OpenAI } from ${JSON.stringify(clientModule)};`
                : `export { withPicturebookModelTelemetry } from ${JSON.stringify(clientModule)};`,
          loader: "js",
        }));
      },
    },
  ],
});

const dependencies = {};
for (const name of Object.keys(bundled.metafile.inputs)) {
  if (name.includes(":") || name === "<stdin>") continue;
  dependencies[name] = hash(await fs.readFile(path.resolve(root, name)));
}
for (const name of [
  "scripts/compare-picturebook-models.mjs",
  "scripts/lib/model-comparison.mjs",
  "scripts/lib/model-comparison-client.mjs",
  "package-lock.json",
]) {
  dependencies[name] = hash(await fs.readFile(path.join(root, name)));
}
const config = {
  sourceHash: hash(source),
  dependencies,
  casesHash: hash(JSON.stringify(cases)),
  fixturesHash: hash(JSON.stringify(fixtures)),
  variants: VARIANTS,
  prices: PRICES,
  budget,
  live: !!options["--run-live"],
};
let manifest;
let results = [];
try {
  manifest = JSON.parse(
    await fs.readFile(path.join(out, "manifest.json"), "utf8"),
  );
  if (!options["--resume"])
    throw new Error("Label exists; use a new label or --resume");
  if (manifest.configHash !== hash(JSON.stringify(config)))
    throw new Error(
      "Resume configuration or source differs. Existing results and spend ledger are preserved. Keep this report directory and start a new --label; do not edit the manifest to bypass the check.",
    );
  evaluation.calls = JSON.parse(
    await fs.readFile(path.join(out, "calls.json"), "utf8"),
  );
  results = JSON.parse(
    await fs.readFile(path.join(out, "results.json"), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  if (options["--resume"]) throw new Error("No complete checkpoint to resume");
  manifest = {
    startedAt: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    config,
    configHash: hash(JSON.stringify(config)),
    status: "prepared",
  };
  await write("manifest.json", manifest);
  await write("calls.json", []);
  await write("results.json", []);
}
evaluation.budget = budget;
evaluation.checkpoint = async () => {
  try {
    await write("calls.json", evaluation.calls);
  } catch (error) {
    evaluation.instrumentationFailed = true;
    throw error;
  }
};
await write("cases.json", cases);

async function report() {
  await write("results.json", results);
  await write("summary.json", {
    status: manifest.status,
    stopped: evaluation.stop,
    committedUpperUSD: committedCost(evaluation.calls),
    metrics: summarize(results, evaluation.calls),
  });
  await write("manifest.json", manifest);
  const lines = [
    "# 호담 텍스트 모델 비교",
    "",
    `상태: ${manifest.status}`,
    `24개 중 선택한 합성 사례: ${cases.length}. 예산: $${budget}.`,
    "",
    "GPT-5.4 집필·검수와 Luna 집필 + Sol 검수를 비교합니다. 운영 프롬프트·검증·50초 단계 제한을 재사용합니다. 두 구성 모두 low 추론, 평가용 출력 상한 6,000토큰, SDK 재시도 0회입니다. 삽화·DB·실제 사용자 데이터는 제외합니다.",
    "",
    "동일 입력과 동일 선택 ID를 사용하되, 생성된 선택 행동 자체는 원고마다 다를 수 있습니다. 사례마다 실행 순서를 교차합니다. 정상/결함 고정 원고 9개로 검수자의 오탐·누락도 별도 확인합니다.",
    "",
    "비용은 API usage와 공개 Standard 단가로 계산한 범위입니다. 누락된 usage와 타임아웃은 0원으로 처리하지 않고 최대 요청 예약액을 유지합니다. 이 상한은 비교 스크립트의 요청 예산이며 세금·프로젝트의 다른 사용량은 포함하지 않습니다. 실패 호출 비용도 완성본당 비용에 포함합니다. 실제 청구는 제공사 결제 내역으로 대조해야 합니다.",
    "",
    "명시적인 --resume은 인증·크레딧·연결·제공사 장애로 중단된 시도만 다시 실행합니다. 기존 실패 결과와 비용 예약은 모두 유지하며 시도 횟수에도 포함합니다. 품질 실패·시간 초과·계측 실패는 재시도하지 않습니다. 코드·설정이 바뀌면 기존 보고서를 보관하고 새 label로 시작해야 합니다.",
    "",
    "| 구성 | 완성/시도 | 교정 호출 | 완성본 p50 / p95 | 텍스트 비용 범위 | 검수 정답 |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  for (const row of summarize(results, evaluation.calls)) {
    const sec = ms => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}초`);
    lines.push(
      `| ${row.variant} | ${row.completedBooks}/${row.attemptedBooks} | ${row.repairCalls} | ${sec(row.completeBookP50ms)} / ${sec(row.completeBookP95ms)} | $${row.costLowerUSD.toFixed(4)}–$${row.costUpperUSD.toFixed(4)} | ${row.fixtureVerdicts.correct}/${row.fixtureVerdicts.total} |`,
    );
  }
  if (evaluation.stop)
    lines.push("", `실행 중단: ${JSON.stringify(evaluation.stop)}`);
  lines.push(
    "",
    "표의 검수 통과는 문학적 품질 점수가 아닙니다. blind-review.md에서 모델명을 가린 원고를 별도로 읽고 낭독 자연스러움·재미·연령 적합성·선택 반영·정서 안전을 판정해야 합니다. 불완전한 비교로 운영 모델을 자동 변경하지 않습니다.",
    "",
    "가격 및 호출 규칙: https://developers.openai.com/api/docs/models/gpt-5.4 · https://developers.openai.com/api/docs/models/gpt-6-luna · https://developers.openai.com/api/docs/models/gpt-6.1-sol · https://developers.openai.com/api/docs/guides/latest-model",
  );
  await fs.writeFile(path.join(out, "report.md"), `${lines.join("\n")}\n`);
  const blind = [
    "# 모델명을 가린 동화 평가",
    "",
    "각 항목을 1–5점으로 평가: 낭독 자연스러움, 장면의 재미, 연령 적합성, 인과·선택 반영. 아동 안전/핵심 입력 위반은 별도로 기록합니다. 평가자는 모델 공개 전에 점수·근거 문장을 남깁니다. 모델 자체 검수 결과는 독립적인 문학 평가가 아닙니다.",
  ];
  const mapping = [];
  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index];
    const pair = settledComparisonResults(results).filter(
      r => r.kind === "story" && r.caseId === item.id && r.ok,
    );
    if (pair.length !== 2) continue;
    pair.sort(
      (a, b) =>
        (a.variant === "baseline" ? 0 : 1) - (b.variant === "baseline" ? 0 : 1),
    );
    if (parseInt(hash(item.id).slice(0, 2), 16) % 2) pair.reverse();
    blind.push("", `## ${item.id}`, "", `입력: ${JSON.stringify(item.input)}`);
    for (let i = 0; i < pair.length; i += 1) {
      const r = pair[i];
      const mark = ["X", "Y"][i];
      mapping.push({ caseId: item.id, mark, variant: r.variant });
      blind.push("", `### 원고 ${mark}: ${r.book.title}`, "");
      for (const page of r.book.pages) {
        blind.push(`**${page.pageNumber}쪽** ${page.textKo}`, "");
        if (page.pageNumber === 4)
          blind.push(
            r.book.choice.promptKo,
            ...r.book.choice.options.map(
              o =>
                `- ${o.id}: ${o.labelKo}${o.id === item.choice ? " (선택)" : ""}`,
            ),
            "",
          );
      }
      blind.push("평가 점수 / 근거 / 결함:", "");
    }
  }
  await fs.writeFile(
    path.join(out, "blind-review.md"),
    `${blind.join("\n")}\n`,
  );
  await write("blind-mapping.json", mapping);
}

try {
  if (options["--dry-run"]) {
    manifest.status = "dry-run-no-api-calls";
    await report();
    console.log(
      `Prepared ${cases.length} cases × 2 configurations + ${fixtures.length} reviewer fixtures × 2. No API calls.\n${path.join(out, "report.md")}`,
    );
    process.exitCode = 0;
  } else {
    const { merged } = loadLocalEnv();
    process.env.OPENAI_API_KEY =
      readEnvValue("OPENAI_API_KEY", { fileEnv: merged }) ||
      readEnvValue("OPEN_AI_API_KEY", { fileEnv: merged });
    if (!process.env.OPENAI_API_KEY)
      throw new Error(
        "Configure OPENAI_API_KEY locally; do not paste it in chat",
      );
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 15000,
      maxRetries: 0,
    });
    const preflight = [];
    for (const model of Object.keys(PRICES)) {
      try {
        await client.models.retrieve(model);
        preflight.push({ model, accessible: true });
      } catch (error) {
        preflight.push({ model, accessible: false, error: safeFailure(error) });
        evaluation.stop = safeFailure(error);
        break;
      }
    }
    await write("preflight.json", preflight);
    if (!evaluation.stop) {
      const pipeline = await import(pathToFileURL(bundlePath));
      const work = [];
      // A one-case pilot precedes the wider run; order alternates to reduce timing bias.
      for (let i = 0; i < cases.length; i += 1) {
        const order = i % 2 ? [...VARIANTS].reverse() : VARIANTS;
        for (const variant of order)
          work.push({ kind: "story", item: cases[i], variant });
      }
      for (let i = 0; i < fixtures.length; i += 1) {
        for (const variant of i % 2 ? [...VARIANTS].reverse() : VARIANTS)
          work.push({ kind: "fixture", item: fixtures[i], variant });
      }
      // Verify the reviewers after the pilot, before consuming the whole budget.
      const reviewerTasks = work.splice(cases.length * 2);
      work.splice(2, 0, ...reviewerTasks);
      for (const task of work) {
        const { item, variant, kind } = task;
        if (evaluation.stop) break;
        const settled = settledComparisonResults(results);
        const pilot = settled.filter(
          r => r.kind === "story" && r.caseId === cases[0].id,
        );
        if (pilot.length === 2 && pilot.some(r => !r.ok)) {
          evaluation.stop = {
            name: "PilotIncomplete",
            status: null,
            code: null,
          };
          break;
        }
        if (
          settled.some(
            r =>
              r.kind === kind &&
              r.caseId === item.id &&
              r.variant === variant.id,
          )
        )
          continue;
        process.env.OPENAI_STORY_MODEL = variant.writer;
        process.env.OPENAI_STORY_REVIEW_MODEL = variant.reviewer;
        evaluation.current = { kind, caseId: item.id, variant: variant.id };
        evaluation.instrumentationFailed = false;
        const firstCall = evaluation.calls.length;
        const result = {
          ...evaluation.current,
          startedAt: new Date().toISOString(),
        };
        const started = Date.now();
        try {
          if (kind === "story") {
            const start = await pipeline.generatePicturebookStart(
              item.input,
              "synthetic-evaluation",
            );
            result.book = await pipeline.generatePicturebookEnding(
              start,
              item.choice,
              "synthetic-evaluation",
            );
            result.ok = true;
          } else {
            result.expectedApproved = item.expectedApproved;
            const review = await pipeline.qaReview(
              item.book,
              item.stage,
              pipeline.qaBudget(item.stage),
            );
            result.review = review;
            result.failures = review.checks
              .filter(c => !c.passed)
              .map(c => c.criterion);
            result.approved = result.failures.length === 0;
            result.matches = item.expectedApproved
              ? result.approved
              : item.expectedFailures.every(c => result.failures.includes(c));
          }
        } catch (error) {
          result.ok = false;
          result.error = safeFailure(error);
          result.infrastructureFailure = isRetryableInfrastructureFailure(
            error,
            {
              lastCallError: evaluation.calls.slice(firstCall).at(-1)?.error,
              instrumentationFailed: evaluation.instrumentationFailed,
            },
          );
          if (evaluation.instrumentationFailed) {
            evaluation.stop = {
              name: "JournalPersistenceError",
              status: null,
              code: null,
            };
          } else if (result.infrastructureFailure && !evaluation.stop) {
            evaluation.stop =
              evaluation.calls.slice(firstCall).at(-1)?.error || result.error;
          }
        }
        result.ms = Date.now() - started;
        results.push(result);
        manifest.status = "running";
        await report();
        console.log(
          `${kind} ${item.id} / ${variant.id}: ${result.ok || result.matches ? "pass" : "failed"}, ${(result.ms / 1000).toFixed(1)}s; reserved/observed upper $${committedCost(evaluation.calls).toFixed(3)}`,
        );
      }
    }
    manifest.status = evaluation.stop ? "blocked" : "completed";
    await report();
    if (evaluation.stop) process.exitCode = 2;
    console.log(
      `Comparison ${manifest.status}: ${path.join(out, "report.md")}`,
    );
  }
} finally {
  await fs.unlink(bundlePath).catch(() => {});
}
