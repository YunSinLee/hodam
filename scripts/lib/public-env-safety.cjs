// This module runs only in Node, before Next can inline public environment values.
// Never include a credential, its fragments, or its decoded payload in diagnostics.
/** @param {string} value */
function decodeJwtPayload(value) {
  const parts = value.split(".");
  if (
    parts.length !== 3 ||
    parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}

/** @param {string} text */
function findPrivateSupabaseCredential(text) {
  if (/\bsb_secret_[A-Za-z0-9_-]+/.test(text)) {
    return "contains a Supabase secret key";
  }
  const tokens = text.matchAll(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  );
  for (const [token] of tokens) {
    if (decodeJwtPayload(token)?.role === "service_role") {
      return "contains a Supabase service-role credential";
    }
  }
  return null;
}

/** @param {Record<string, string | undefined>} env */
function assertSafePublicEnv(env = process.env) {
  for (const [name, rawValue] of Object.entries(env)) {
    if (!name.startsWith("NEXT_PUBLIC_") || typeof rawValue !== "string")
      continue;
    const reason = findPrivateSupabaseCredential(rawValue);
    if (reason)
      throw new Error(`Unsafe public environment variable: ${name} ${reason}.`);
  }

  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  // Missing configuration remains supported for CI/static analysis. The normal
  // environment check still requires it when checking a configured deployment.
  if (!key) return;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  if (decodeJwtPayload(key)?.role === "anon") return;
  throw new Error(
    "Unsafe public environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY must be an anon JWT or a Supabase publishable key.",
  );
}

module.exports = { assertSafePublicEnv, findPrivateSupabaseCredential };
