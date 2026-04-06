#!/usr/bin/env node

import fs from "fs";
import path from "path";

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

  for (const fileName of envFilesInOrder) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;
    Object.assign(merged, parseEnvFile(fs.readFileSync(fullPath, "utf8")));
  }

  return merged;
}

const fileEnv = loadFileEnv();
const DEFAULT_TEST_USER_EMAIL = "hodam.e2e.runner@gmail.com";
const DEFAULT_TEST_USER_PASSWORD = "HodamE2E!23456";

function readEnv(name) {
  const processValue = process.env[name];
  if (typeof processValue === "string" && processValue.trim()) {
    return processValue.trim();
  }

  const fileValue = fileEnv[name];
  if (typeof fileValue === "string" && fileValue.trim()) {
    return fileValue.trim();
  }

  return "";
}

function pickAuthUrl(baseUrl) {
  return `${baseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;
}

async function main() {
  const explicitAccessToken = readEnv("HODAM_TEST_ACCESS_TOKEN");
  if (explicitAccessToken) {
    process.stdout.write(explicitAccessToken);
    return;
  }

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = readEnv("HODAM_TEST_USER_EMAIL") || DEFAULT_TEST_USER_EMAIL;
  const password =
    readEnv("HODAM_TEST_USER_PASSWORD") || DEFAULT_TEST_USER_PASSWORD;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const response = await fetch(pickAuthUrl(supabaseUrl), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }

  if (!response.ok || !body || typeof body !== "object") {
    const fallbackHint =
      email === DEFAULT_TEST_USER_EMAIL
        ? " (fallback test user used; ensure DB has confirmed user)"
        : "";
    throw new Error(
      `Failed to issue access token (${response.status})${fallbackHint}: ${bodyText.slice(0, 300)}`,
    );
  }

  const accessToken =
    typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!accessToken) {
    throw new Error("Access token response did not include access_token");
  }

  process.stdout.write(accessToken);
}

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
