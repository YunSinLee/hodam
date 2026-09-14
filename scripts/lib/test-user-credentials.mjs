export const GENERATED_TEST_USER_EMAIL = "hodam.e2e.default@example.com";
export const GENERATED_TEST_USER_PASSWORD = "HodamE2E!Passw0rd";

export function resolveTestUserCredentials({
  primaryEmail = "",
  primaryPassword = "",
  fallbackEmail = "",
  fallbackPassword = "",
  allowGeneratedDefaults = false,
} = {}) {
  const hasPartialCredentials = Boolean(
    (primaryEmail && !primaryPassword) ||
      (!primaryEmail && primaryPassword) ||
      (fallbackEmail && !fallbackPassword) ||
      (!fallbackEmail && fallbackPassword),
  );

  const email = primaryEmail || fallbackEmail;
  const password = primaryPassword || fallbackPassword;
  const isConfigured = Boolean(email && password);
  let source =
    primaryEmail && primaryPassword
      ? "primary"
      : fallbackEmail && fallbackPassword
        ? "fallback"
        : "missing";

  if (!isConfigured && allowGeneratedDefaults && !hasPartialCredentials) {
    return {
      email: GENERATED_TEST_USER_EMAIL,
      password: GENERATED_TEST_USER_PASSWORD,
      isConfigured: true,
      source: "generated_default",
    };
  }

  return {
    email,
    password,
    isConfigured,
    source,
  };
}

export function getMissingTestUserCredentialsMessage() {
  return (
    "Missing test-user credentials. Set HODAM_TEST_USER_EMAIL/HODAM_TEST_USER_PASSWORD " +
    "or HODAM_TEST_DEFAULT_USER_EMAIL/HODAM_TEST_DEFAULT_USER_PASSWORD " +
    "(or enable HODAM_TEST_AUTO_USER=1 with SUPABASE_SERVICE_ROLE_KEY)."
  );
}
