export function createAccessTokenMeta({
  explicitToken = "",
  scriptStatus = 0,
  scriptStdout = "",
  scriptStderr = "",
} = {}) {
  if (explicitToken) {
    return {
      token: explicitToken,
      source: "env",
      reason: "",
    };
  }

  if (scriptStatus !== 0) {
    const reason =
      `${scriptStderr || scriptStdout}`.trim() || `exit=${scriptStatus}`;
    return {
      token: "",
      source: "script",
      reason,
    };
  }

  const token = `${scriptStdout || ""}`.trim();
  if (!token) {
    return {
      token: "",
      source: "script",
      reason: "empty token output",
    };
  }

  return {
    token,
    source: "script",
    reason: "",
  };
}

export function collectWebhookE2EMissingEnv({
  supabaseUrl = "",
  supabaseAnonKey = "",
  serviceRoleKey = "",
  accessToken = "",
  requireServiceRole = true,
  requireAccessToken = true,
} = {}) {
  const missing = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (requireServiceRole && !serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (requireAccessToken && !accessToken) {
    missing.push("HODAM_TEST_ACCESS_TOKEN");
  }
  return missing;
}

export function shouldEnsureTestUser({ email = "", password = "" } = {}) {
  return Boolean(email && password);
}
