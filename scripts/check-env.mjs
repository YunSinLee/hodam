#!/usr/bin/env node

import path from "path";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict");
const nodeEnv = process.env.NODE_ENV || "development";
const cwd = process.cwd();
const { merged: fileEnv, loaded: loadedFilePaths } = loadLocalEnv({
  cwd,
  nodeEnv,
});
const loadedFiles = loadedFilePaths.map(fullPath => path.basename(fullPath));

function getEnvValue(name) {
  return readEnvValue(name, {
    processEnv: process.env,
    fileEnv,
  });
}

function maskValue(value) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

const REQUIRED_KEYS = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    description: "Supabase project URL",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    description: "Supabase anon public key",
  },
];

const REQUIRED_ONE_OF = [
  {
    keys: ["OPENAI_API_KEY", "OPEN_AI_API_KEY"],
    description: "OpenAI API key for story/translation/image generation",
  },
];

const RECOMMENDED_KEYS = [
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    description: "Supabase service role key (required for admin/webhook flows)",
  },
  {
    key: "SUPABASE_ACCESS_TOKEN",
    description: "Supabase personal access token (for Management API advisor checks)",
  },
  {
    key: "TOSS_PAYMENTS_SECRET_KEY",
    description: "Toss payment confirmation secret",
  },
  {
    key: "TOSS_PAYMENTS_WEBHOOK_SECRET",
    description: "Toss webhook signature secret",
  },
  {
    key: "TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET",
    description: "Toss webhook HMAC secret for payload signature verification",
  },
  {
    key: "NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY",
    description: "Toss client key for browser payment widget",
  },
  {
    key: "NEXT_PUBLIC_SITE_URL",
    description: "Canonical site origin used by OAuth redirect checks",
  },
  {
    key: "NEXT_PUBLIC_AUTH_REDIRECT_URL",
    description: "Explicit OAuth callback URL for production",
  },
  {
    key: "HODAM_DAILY_AI_COST_LIMIT",
    description: "Daily AI quota limit (server-side)",
  },
  {
    key: "HODAM_DAILY_TTS_CHAR_LIMIT",
    description: "Daily TTS character quota limit (server-side)",
  },
  {
    key: "SENTRY_DSN",
    description: "Sentry DSN for production error monitoring",
  },
];

const requireOpenAiKey =
  strictMode ||
  nodeEnv === "production" ||
  getEnvValue("HODAM_REQUIRE_OPENAI_KEY") === "1";

const missingRequired = [];
const missingRecommended = [];
const validationWarnings = [];

function readOrigin(rawValue) {
  if (!rawValue) return null;
  try {
    return new URL(rawValue).origin;
  } catch {
    return null;
  }
}

console.log("HODAM environment check");
console.log(`- node env: ${nodeEnv}`);
console.log(
  `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
);
console.log("");

for (const item of REQUIRED_KEYS) {
  const value = getEnvValue(item.key);
  if (!value) {
    missingRequired.push(item.key);
    console.log(`✗ required  ${item.key} (${item.description})`);
  } else {
    console.log(`✓ required  ${item.key} = ${maskValue(value)}`);
  }
}

for (const item of REQUIRED_ONE_OF) {
  const foundKey = item.keys.find(key => getEnvValue(key));
  if (!foundKey) {
    if (requireOpenAiKey) {
      missingRequired.push(item.keys.join(" | "));
      console.log(`✗ required  ${item.keys.join(" | ")} (${item.description})`);
    } else {
      missingRecommended.push(item.keys.join(" | "));
      console.log(`! optional  ${item.keys.join(" | ")} missing (${item.description})`);
    }
  } else {
    console.log(
      `✓ required  ${foundKey} = ${maskValue(getEnvValue(foundKey))}`,
    );
  }
}

for (const item of RECOMMENDED_KEYS) {
  const value = getEnvValue(item.key);
  if (!value) {
    missingRecommended.push(item.key);
    console.log(`! optional  ${item.key} missing (${item.description})`);
  } else {
    console.log(`✓ optional  ${item.key} = ${maskValue(value)}`);
  }
}

const configuredSiteUrl = getEnvValue("NEXT_PUBLIC_SITE_URL");
const configuredAuthRedirectUrl = getEnvValue("NEXT_PUBLIC_AUTH_REDIRECT_URL");
const siteOrigin = readOrigin(configuredSiteUrl);
const redirectOrigin = readOrigin(configuredAuthRedirectUrl);

if (configuredSiteUrl && !siteOrigin) {
  validationWarnings.push(
    "NEXT_PUBLIC_SITE_URL is not a valid absolute URL.",
  );
}

if (configuredAuthRedirectUrl && !redirectOrigin) {
  validationWarnings.push(
    "NEXT_PUBLIC_AUTH_REDIRECT_URL is not a valid absolute URL.",
  );
}

if (siteOrigin && redirectOrigin && siteOrigin !== redirectOrigin) {
  validationWarnings.push(
    `NEXT_PUBLIC_SITE_URL origin (${siteOrigin}) does not match NEXT_PUBLIC_AUTH_REDIRECT_URL origin (${redirectOrigin}).`,
  );
}

if (
  configuredAuthRedirectUrl &&
  configuredAuthRedirectUrl.includes("/auth/callback") === false
) {
  validationWarnings.push(
    "NEXT_PUBLIC_AUTH_REDIRECT_URL should point to /auth/callback.",
  );
}

const adminFallbackRaw = getEnvValue("HODAM_ALLOW_ADMIN_FALLBACK");
if (adminFallbackRaw) {
  const normalized = adminFallbackRaw.toLowerCase();
  if (normalized === "true" && nodeEnv === "production") {
    validationWarnings.push(
      "HODAM_ALLOW_ADMIN_FALLBACK=true should not be used in production.",
    );
  }
}

console.log("");
for (const warning of validationWarnings) {
  console.log(`! validate  ${warning}`);
}

if (validationWarnings.length > 0) {
  console.log("");
}

if (missingRequired.length > 0) {
  console.error(
    `Failed: missing required env keys (${missingRequired.join(", ")})`,
  );
  process.exit(1);
}

if (strictMode && missingRecommended.length > 0) {
  console.error(
    `Failed (strict): missing recommended env keys (${missingRecommended.join(", ")})`,
  );
  process.exit(1);
}

if (strictMode && validationWarnings.length > 0) {
  console.error(
    `Failed (strict): invalid env configuration (${validationWarnings.join(" | ")})`,
  );
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.log(
    `Passed with warnings: recommended keys missing (${missingRecommended.join(", ")})`,
  );
  process.exit(0);
}

console.log("Passed: all required/recommended env keys are set.");
