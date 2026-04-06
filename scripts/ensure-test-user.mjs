#!/usr/bin/env node

import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV || "development";
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

function isUserAlreadyExistsError(message) {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate")
  );
}

async function findUserByEmail(admin, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find(user => (user.email || "").toLowerCase() === email);
    if (found) {
      return found;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function main() {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = readEnv("HODAM_TEST_USER_EMAIL") || DEFAULT_TEST_USER_EMAIL;
  const password =
    readEnv("HODAM_TEST_USER_PASSWORD") || DEFAULT_TEST_USER_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ensure-test-user.",
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const createResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      hodam_test_user: true,
    },
  });

  if (!createResult.error) {
    console.log(`Created test user: ${email}`);
    return;
  }

  if (!isUserAlreadyExistsError(createResult.error.message)) {
    throw new Error(`Failed to create test user: ${createResult.error.message}`);
  }

  const existingUser = await findUserByEmail(admin, email.toLowerCase());
  if (!existingUser?.id) {
    throw new Error(
      "Test user appears to exist but could not be found via admin.listUsers.",
    );
  }

  const updateResult = await admin.auth.admin.updateUserById(existingUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(existingUser.user_metadata || {}),
      hodam_test_user: true,
    },
  });

  if (updateResult.error) {
    throw new Error(`Failed to update test user: ${updateResult.error.message}`);
  }

  console.log(`Updated existing test user: ${email}`);
}

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
