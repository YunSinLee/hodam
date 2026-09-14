#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";
import {
  getMissingTestUserCredentialsMessage,
  resolveTestUserCredentials,
} from "./lib/test-user-credentials.mjs";

const fileEnv = loadLocalEnv().merged;

function readEnv(name) {
  return readEnvValue(name, { fileEnv });
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
  const credentials = resolveTestUserCredentials({
    primaryEmail: readEnv("HODAM_TEST_USER_EMAIL"),
    primaryPassword: readEnv("HODAM_TEST_USER_PASSWORD"),
    fallbackEmail: readEnv("HODAM_TEST_DEFAULT_USER_EMAIL"),
    fallbackPassword: readEnv("HODAM_TEST_DEFAULT_USER_PASSWORD"),
    allowGeneratedDefaults: readEnv("HODAM_TEST_AUTO_USER") === "1",
  });

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ensure-test-user.",
    );
  }
  if (!credentials.isConfigured) {
    throw new Error(getMissingTestUserCredentialsMessage());
  }
  const { email, password } = credentials;

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
