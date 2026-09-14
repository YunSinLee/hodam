#!/usr/bin/env node

import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";
import {
  getMissingTestUserCredentialsMessage,
  resolveTestUserCredentials,
} from "./lib/test-user-credentials.mjs";

const fileEnv = loadLocalEnv().merged;

function readEnv(name) {
  return readEnvValue(name, { fileEnv });
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
  const credentials = resolveTestUserCredentials({
    primaryEmail: readEnv("HODAM_TEST_USER_EMAIL"),
    primaryPassword: readEnv("HODAM_TEST_USER_PASSWORD"),
    fallbackEmail: readEnv("HODAM_TEST_DEFAULT_USER_EMAIL"),
    fallbackPassword: readEnv("HODAM_TEST_DEFAULT_USER_PASSWORD"),
    allowGeneratedDefaults: readEnv("HODAM_TEST_AUTO_USER") === "1",
  });

  if (!credentials.isConfigured) {
    throw new Error(getMissingTestUserCredentialsMessage());
  }
  const { email, password } = credentials;

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
    throw new Error(
      `Failed to issue access token (${response.status}, source=${credentials.source}): ${bodyText.slice(0, 300)}`,
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
