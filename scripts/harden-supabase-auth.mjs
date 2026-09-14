#!/usr/bin/env node

import fs from "fs";
import path from "path";

import {
  createAuthSecurityPlan,
  parseBoolean,
  parsePositiveInteger,
  toAuthSecurityState,
} from "./lib/supabase-auth-security-utils.mjs";

const args = new Set(process.argv.slice(2));

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

const applyMode = args.has("--apply");
const otpArg = readArgValue("--otp-exp");
const hibpArg = readArgValue("--hibp");

const nodeEnv = process.env.NODE_ENV || "development";
const cwd = process.cwd();
const envFilesInOrder = [
  ".env",
  `.env.${nodeEnv}`,
  ".env.local",
  `.env.${nodeEnv}.local`,
];

function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    const rawValue = line.slice(equalIndex + 1).trim();
    const unquotedValue =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue.startsWith("'") && rawValue.endsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue;

    result[key] = unquotedValue;
  }

  return result;
}

function loadFileEnv() {
  const merged = {};
  const loaded = [];

  for (const fileName of envFilesInOrder) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    Object.assign(merged, parseEnvFile(content));
    loaded.push(fileName);
  }

  return { merged, loaded };
}

const { merged: fileEnv, loaded: loadedFiles } = loadFileEnv();

function readEnv(name) {
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }

  const fromFile = fileEnv[name];
  if (typeof fromFile === "string" && fromFile.trim()) {
    return fromFile.trim();
  }

  return "";
}

function safeJsonParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

class HttpError extends Error {
  constructor(status, body) {
    const bodyText =
      typeof body === "string"
        ? body
        : body && typeof body === "object"
          ? JSON.stringify(body)
          : String(body || "");
    super(bodyText);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

async function getAuthConfig({ projectRef, accessToken }) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const rawText = await response.text();
  const json = safeJsonParse(rawText);

  if (!response.ok || !json || typeof json !== "object") {
    throw new Error(
      `Failed to fetch auth config (${response.status}): ${rawText.slice(0, 600)}`,
    );
  }

  return json;
}

async function patchAuthConfig({ projectRef, accessToken, patch }) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    },
  );

  const rawText = await response.text();
  const json = safeJsonParse(rawText);

  if (!response.ok || !json || typeof json !== "object") {
    throw new HttpError(
      response.status,
      json || rawText.slice(0, 600),
    );
  }

  return json;
}

async function main() {
  const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const explicitProjectRef = readEnv("SUPABASE_PROJECT_REF");

  if (!accessToken) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN");
  }
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const projectRef =
    explicitProjectRef ||
    (() => {
      const host = new URL(supabaseUrl).hostname;
      if (!host.endsWith(".supabase.co")) {
        throw new Error(
          "SUPABASE_PROJECT_REF is required when NEXT_PUBLIC_SUPABASE_URL is not a *.supabase.co URL",
        );
      }
      return host.split(".")[0];
    })();

  const targetOtpExp = parsePositiveInteger(
    otpArg || readEnv("HODAM_AUTH_MAILER_OTP_EXP"),
    3600,
    "otp-exp",
  );
  const targetHibpEnabled = parseBoolean(
    hibpArg || readEnv("HODAM_AUTH_PASSWORD_HIBP_ENABLED"),
    true,
  );

  console.log("HODAM Supabase auth hardening");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );
  console.log(`- project ref: ${projectRef}`);
  console.log(`- mode: ${applyMode ? "apply" : "dry-run"}`);
  console.log(
    `- target: mailer_otp_exp=${targetOtpExp}, password_hibp_enabled=${targetHibpEnabled}`,
  );

  const currentConfig = await getAuthConfig({ projectRef, accessToken });
  const plan = createAuthSecurityPlan(currentConfig, {
    mailerOtpExp: targetOtpExp,
    passwordHibpEnabled: targetHibpEnabled,
  });

  console.log(
    `- current: mailer_otp_exp=${plan.current.mailerOtpExp}, password_hibp_enabled=${plan.current.passwordHibpEnabled}`,
  );

  if (!plan.hasChanges) {
    console.log("No changes required. Auth security config is already hardened.");
    return;
  }

  console.log("Planned changes:");
  plan.changes.forEach(change => {
    console.log(
      `  - ${change.field}: ${change.current} -> ${change.target}`,
    );
  });

  if (!applyMode) {
    console.log("Dry-run mode: no changes applied. Re-run with --apply.");
    return;
  }

  const appliedFields = [];
  const skippedFields = [];

  const tryPatch = async (field, patch) => {
    try {
      await patchAuthConfig({
        projectRef,
        accessToken,
        patch,
      });
      appliedFields.push(field);
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status === 402 &&
        field === "password_hibp_enabled"
      ) {
        skippedFields.push(
          `${field}: feature is unavailable on current Supabase plan`,
        );
        return;
      }

      const reason =
        error instanceof HttpError
          ? `(${error.status}) ${typeof error.body === "string" ? error.body : JSON.stringify(error.body)}`
          : error instanceof Error
            ? error.message
            : String(error);
      throw new Error(`Failed to patch ${field} ${reason}`);
    }
  };

  if ("mailer_otp_exp" in plan.patch) {
    await tryPatch("mailer_otp_exp", {
      mailer_otp_exp: plan.patch.mailer_otp_exp,
    });
  }

  if ("password_hibp_enabled" in plan.patch) {
    await tryPatch("password_hibp_enabled", {
      password_hibp_enabled: plan.patch.password_hibp_enabled,
    });
  }

  if (appliedFields.length === 0 && skippedFields.length > 0) {
    console.log("No auth hardening fields were applied.");
  } else if (appliedFields.length === 0) {
    console.log("No auth hardening fields were applied.");
  } else {
    console.log(`Applied auth hardening fields: ${appliedFields.join(", ")}`);
  }

  if (skippedFields.length > 0) {
    console.log("Skipped fields:");
    skippedFields.forEach(item => {
      console.log(`  - ${item}`);
    });
  }

  const updatedConfig = await getAuthConfig({ projectRef, accessToken });
  const nextState = toAuthSecurityState(updatedConfig);
  console.log(
    `- updated: mailer_otp_exp=${nextState.mailerOtpExp}, password_hibp_enabled=${nextState.passwordHibpEnabled}`,
  );
}

main().catch(error => {
  console.error(
    "Supabase auth hardening failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
