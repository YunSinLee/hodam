#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

function resolveRuntimeOrigin() {
  const argValue = readArgValue("--runtime-origin");
  if (argValue) return argValue;

  const fromEnv =
    process.env.HODAM_RUNTIME_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (fromEnv.trim()) return fromEnv.trim();

  return "http://localhost:3000";
}

function hasAnyOpenAiKey() {
  return Boolean(
    (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) ||
      (process.env.OPEN_AI_API_KEY && process.env.OPEN_AI_API_KEY.trim()),
  );
}

function runStep(step) {
  const env = {
    ...process.env,
    ...(step.env || {}),
  };

  if (!hasAnyOpenAiKey() && step.ensureDummyOpenAiKey) {
    env.OPENAI_API_KEY = "dummy";
  }

  console.log(`\n[step] ${step.name}`);
  console.log(`[cmd]  ${step.command}`);

  const result = spawnSync(step.command, {
    shell: true,
    stdio: "inherit",
    env,
  });

  return {
    ...step,
    status: result.status === null ? 1 : result.status,
  };
}

const runtimeOrigin = resolveRuntimeOrigin();
const continueOnError = args.has("--continue-on-error");
const skipAuthE2E = args.has("--skip-e2e-auth");
const skipPaymentsE2E = args.has("--skip-e2e-payments");
const postDbUpgrade = args.has("--post-db-upgrade");

const steps = [
  {
    name: "quality-gate",
    command: "npm run check:all",
    ensureDummyOpenAiKey: true,
  },
  {
    name: "supabase-security",
    command: "npm run check:supabase:security",
  },
  {
    name: postDbUpgrade
      ? "supabase-security-strict-post-upgrade"
      : "supabase-security-strict-baseline",
    command: postDbUpgrade
      ? "npm run check:supabase:security:strict:post-upgrade"
      : "npm run check:supabase:security:strict:baseline",
  },
  {
    name: "oauth-runtime-check",
    command: `npm run check:oauth -- --runtime-origin=${runtimeOrigin}`,
  },
  ...(!skipAuthE2E
    ? [
        {
          name: "auth-e2e-local",
          command: "npm run test:e2e:auth:local",
        },
      ]
    : []),
  ...(!skipPaymentsE2E
    ? [
        {
          name: "payments-e2e-local",
          command: "npm run test:e2e:payments:local",
        },
      ]
    : []),
];

console.log("HODAM post-upgrade validation");
console.log(`- runtime origin: ${runtimeOrigin}`);
console.log(`- continue on error: ${continueOnError}`);
console.log(`- skip auth e2e: ${skipAuthE2E}`);
console.log(`- skip payments e2e: ${skipPaymentsE2E}`);
console.log(`- post db upgrade mode: ${postDbUpgrade}`);

const results = [];
let failed = false;

for (const step of steps) {
  const result = runStep(step);
  results.push(result);

  if (result.status !== 0) {
    failed = true;
    if (!continueOnError) {
      break;
    }
  }
}

console.log("\nSummary:");
results.forEach(result => {
  const icon = result.status === 0 ? "✓" : "✗";
  console.log(`- ${icon} ${result.name} (exit=${result.status})`);
});

if (failed) {
  console.error("\nPost-upgrade validation failed.");
  process.exit(1);
}

console.log("\nPost-upgrade validation passed.");
