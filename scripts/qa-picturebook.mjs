#!/usr/bin/env node

// Opt-in, text-only evaluation of the actual generation/revision pipeline.
// Uses synthetic inputs and live OpenAI calls; never writes books or spends beads.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
}
if (!args.includes("--run-live")) {
  console.log(
    "Live text QA (uses OpenAI credits, no images or database writes):",
  );
  console.log("node scripts/qa-picturebook.mjs --run-live --label revised");
  console.log("Optional: --case night|sharing|school --source-ref <git-ref>");
  console.log(
    "Judge regression fixtures: --fixtures (also requires --run-live)",
  );
  process.exit(0);
}

const label = option("--label", new Date().toISOString().replace(/[:.]/g, "-"));
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("Invalid output label");
const sourceRef = option("--source-ref", "");
const caseId = option("--case", "");
const fixtureMode = args.includes("--fixtures");
const allCases = [
  {
    id: "night",
    choice: "A",
    input: {
      childName: "별이",
      childAge: "6",
      tone: "calm",
      situation: "불을 끄면 무섭다며 혼자 잠들기 어려워해요.",
      lesson: "곁에 있는 따뜻함을 느끼며 천천히 안심하는 마음",
      interests: "토끼 인형, 작은 별",
    },
  },
  {
    id: "sharing",
    choice: "B",
    input: {
      childName: "하루",
      childAge: "3",
      tone: "playful",
      situation:
        "놀이터에서 친구가 빨간 삽을 쓰고 싶어 하자 꼭 쥐고 놓지 않았어요.",
      lesson: "내 차례와 친구 차례를 기다리며 함께 노는 즐거움",
      interests: "오리, 모래놀이",
    },
  },
  {
    id: "school",
    choice: "C",
    input: {
      childName: "도윤",
      childAge: "10",
      tone: "brave",
      situation:
        "새 학교에서 모둠 활동에 끼고 싶었지만 말을 걸지 못하고 그림만 그렸어요.",
      lesson: "긴장해도 작은 말 한마디로 마음을 전해보기",
      interests: "우주, 연필 그림",
    },
  },
];
const cases = caseId ? allCases.filter(item => item.id === caseId) : allCases;
if (!cases.length) throw new Error("Unknown case");

const root = process.cwd();
const { merged } = loadLocalEnv({ cwd: root });
const read = key => readEnvValue(key, { fileEnv: merged });
process.env.OPENAI_API_KEY = read("OPENAI_API_KEY") || read("OPEN_AI_API_KEY");
if (!process.env.OPENAI_API_KEY)
  throw new Error("OpenAI key is not configured");
process.env.OPENAI_STORY_MODEL =
  read("OPENAI_STORY_MODEL") || "gpt-5.4-2026-03-05";
const reviewerModel = read("OPENAI_STORY_REVIEW_MODEL");
if (reviewerModel) process.env.OPENAI_STORY_REVIEW_MODEL = reviewerModel;

const sourcePath = "src/app/api/langchain.ts";
const source = sourceRef
  ? execFileSync("git", ["show", `${sourceRef}:${sourcePath}`], {
      encoding: "utf8",
    })
  : await fs.readFile(path.join(root, sourcePath), "utf8");
const outputDir = path.join(root, "reports/local/picturebook-evals", label);
await fs.mkdir(outputDir, { recursive: true });
const bundlePath = path.join(outputDir, "pipeline.mjs");
await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  JSON.stringify(
    {
      startedAt: new Date().toISOString(),
      sourceRef: sourceRef || "working tree",
      sourceHash: createHash("sha256").update(source).digest("hex"),
      writerModel: process.env.OPENAI_STORY_MODEL,
      reviewerModel:
        process.env.OPENAI_STORY_REVIEW_MODEL || "gpt-5.4-2026-03-05",
      fixtureMode,
    },
    null,
    2,
  ),
);

await build({
  stdin: {
    contents: `${source}\nexport { qaCalls } from 'qa-recorder';${fixtureMode ? "\nexport { reviewCandidateForQuality as qaReview, createModelBudget as qaBudget };" : ""}`,
    resolveDir: path.dirname(path.join(root, sourcePath)),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: bundlePath,
  plugins: [
    {
      name: "isolated-text-qa",
      setup(builder) {
        builder.onResolve(
          { filter: /^server-only$|^\.\/server-auth$/ },
          () => ({ path: "auth", namespace: "qa" }),
        );
        builder.onResolve({ filter: /^openai$|^qa-recorder$/ }, args =>
          args.namespace === "qa"
            ? { path: "openai", external: true }
            : { path: "recorder", namespace: "qa" },
        );
        builder.onLoad({ filter: /^auth$/, namespace: "qa" }, () => ({
          contents:
            "export async function requireServerUser() { return { user: { id: 'synthetic-qa' } }; }",
          loader: "js",
        }));
        builder.onLoad({ filter: /^recorder$/, namespace: "qa" }, () => ({
          contents: `
        import { OpenAI as Client } from 'openai';
        export const qaCalls = [];
        export class OpenAI {
          constructor(config) {
            const client = new Client(config);
            this.chat = { completions: { create: async (params, options) => {
              const started = Date.now();
              const call = { model: params.model, messages: params.messages, responseFormat: params.response_format, timeout: options.timeout };
              qaCalls.push(call);
              try {
                const response = await client.chat.completions.create(params, options);
                Object.assign(call, { ms: Date.now() - started, usage: response.usage, content: response.choices[0]?.message.content, finishReason: response.choices[0]?.finish_reason });
                return response;
              } catch (error) {
                Object.assign(call, { ms: Date.now() - started, error: error.name, errorStatus: error.status, errorCode: error.code, errorParam: error.param });
                throw error;
              }
            } } };
            this.images = { generate() { throw new Error('Image generation is disabled in text QA'); } };
          }
        }
      `,
          loader: "js",
        }));
      },
    },
  ],
});

try {
  const {
    generatePicturebookStart,
    generatePicturebookEnding,
    qaCalls,
    qaReview,
    qaBudget,
  } = await import(pathToFileURL(bundlePath));
  if (fixtureMode) {
    const fixtures = JSON.parse(
      await fs.readFile(
        path.join(root, "scripts/fixtures/picturebook-quality.json"),
        "utf8",
      ),
    );
    const outcomes = [];
    for (const fixture of fixtures) {
      const before = qaCalls.length;
      let outcome;
      try {
        const review = await qaReview(fixture.book, fixture.stage, qaBudget());
        const failures = review.checks
          .filter(check => !check.passed)
          .map(check => check.criterion);
        const matches = fixture.expectedApproved
          ? failures.length === 0
          : fixture.expectedFailures.every(criterion =>
              failures.includes(criterion),
            );
        outcome = {
          id: fixture.id,
          matches,
          failures,
          review,
          calls: qaCalls.slice(before),
        };
      } catch (error) {
        outcome = {
          id: fixture.id,
          matches: false,
          error: error.name,
          calls: qaCalls.slice(before),
        };
      }
      if (!outcome.matches) process.exitCode = 1;
      outcomes.push(outcome);
      console.log(
        `${fixture.id}: ${outcome.matches ? "expected verdict" : "regression"}${outcome.error ? ` (${outcome.error})` : ` [${outcome.failures.join(", ")}]`}`,
      );
    }
    await fs.writeFile(
      path.join(outputDir, "fixtures.json"),
      JSON.stringify(outcomes, null, 2),
    );
    console.log(
      `Fixture verdicts: ${outcomes.filter(item => item.matches).length}/${outcomes.length}`,
    );
  } else {
    const results = [];
    for (const item of cases) {
      const started = Date.now();
      const callsBefore = qaCalls.length;
      let result;
      try {
        const start = await generatePicturebookStart(
          item.input,
          "synthetic-qa",
        );
        const book = await generatePicturebookEnding(
          start,
          item.choice,
          "synthetic-qa",
        );
        result = {
          ...item,
          ok: true,
          ms: Date.now() - started,
          book,
          calls: qaCalls.slice(callsBefore),
        };
      } catch (error) {
        result = {
          ...item,
          ok: false,
          ms: Date.now() - started,
          error: error.name,
          calls: qaCalls.slice(callsBefore),
        };
        process.exitCode = 1;
      }
      results.push(result);
      await fs.writeFile(
        path.join(outputDir, `${item.id}.json`),
        JSON.stringify(result, null, 2),
      );
      console.log(
        `${item.id}: ${result.ok ? "complete" : "failed"}, ${result.calls.length} model calls, ${Math.round(result.ms / 1000)}s`,
      );
    }
    const usage = qaCalls.reduce(
      (sum, call) => sum + (call.usage?.total_tokens || 0),
      0,
    );
    const report = [
      `# Picturebook text QA: ${label}`,
      "",
      `Model: ${process.env.OPENAI_STORY_MODEL}. Source: ${sourceRef || "working tree"}.`,
      `Synthetic cases; no images or database writes. Observed total tokens: ${usage}.`,
      "",
      "These are samples, not a literary quality score. Review narration, vocabulary, causality, choices, visual continuity and the ending manually.",
    ];
    for (const result of results) {
      report.push(
        "",
        `## ${result.id}: ${result.input.childAge}세 / ${result.input.tone}`,
        "",
        result.input.situation,
      );
      if (!result.ok) {
        report.push(
          "",
          "Generation failed; inspect the local JSON call record.",
        );
        continue;
      }
      report.push("", `### ${result.book.title}`, "");
      for (const page of result.book.pages) {
        report.push(`**${page.pageNumber}쪽** ${page.textKo}`, "");
        if (page.pageNumber === 4)
          report.push(
            result.book.choice.promptKo,
            ...result.book.choice.options.map(
              choice =>
                `- ${choice.id}: ${choice.labelKo}${choice.id === result.choice ? " (selected)" : ""}`,
            ),
            "",
          );
      }
      report.push(
        `Quality path: ${(result.book.qualityNotes || []).join(", ")}`,
      );
    }
    await fs.writeFile(
      path.join(outputDir, "report.md"),
      `${report.join("\n")}\n`,
    );
    console.log(
      `Report: ${path.relative(root, path.join(outputDir, "report.md"))}`,
    );
  }
} finally {
  await fs.unlink(bundlePath);
}
