// Reviewed against live pg_get_functiondef + callers on 2026-10-08.
// See docs/security-definer-review.md. This is signature + role specific: a new
// overload, schema, role, or function is never covered by an existing entry.
export const reviewedSecurityDefiners = [
  {
    name: "consume_beads",
    arguments: "p_user_id uuid, p_cost integer, p_request_id text",
    roles: ["authenticated"],
    reason:
      "Debits only auth.uid(); service_role is the explicit server exception.",
  },
  {
    name: "consume_daily_quota",
    arguments:
      "p_user_id uuid, p_action text, p_cost integer, p_daily_limit integer, p_meta jsonb",
    roles: ["authenticated"],
    reason:
      "Quota rows are restricted to auth.uid(); no other account can be charged.",
  },
  {
    name: "get_my_threads",
    arguments: "",
    roles: ["authenticated"],
    reason: "Every returned thread is filtered by t.user_id = auth.uid().",
  },
  {
    name: "get_thread_detail",
    arguments: "p_thread_id bigint",
    roles: ["authenticated"],
    reason: "Child rows are joined through a thread owned by auth.uid().",
  },
  {
    name: "get_payment_webhook_transmissions",
    arguments: "p_order_id text, p_user_id uuid",
    roles: ["authenticated"],
    reason:
      "Rejects mismatched/null caller IDs and joins the caller's payment_history.",
  },
  {
    name: "get_auth_callback_metrics_by_attempt",
    arguments: "p_attempt_id text, p_limit integer",
    roles: ["anon", "authenticated"],
    reason:
      "Intentional pre-login diagnostics: exact bounded attempt ID, 24-hour window, at most 61 rows.",
  },
  {
    name: "record_auth_callback_metric",
    arguments:
      "p_stage text, p_callback_path text, p_timestamp_ms bigint, p_details jsonb",
    roles: ["anon", "authenticated"],
    reason:
      "Intentional pre-login telemetry: bounded stage/path/time and allowlisted detail fields; no balances or book rows.",
  },
];

const roleForLint = {
  anon_security_definer_function_executable: "anon",
  authenticated_security_definer_function_executable: "authenticated",
};

export function isDefinerExecutionAdvisory(name) {
  return Object.hasOwn(roleForLint, name);
}

function normalizeArguments(value) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ",")
    : null;
}

export function reviewedDefinerForAdvisory(lint) {
  if (!lint || lint.level !== "WARN" || !isDefinerExecutionAdvisory(lint.name))
    return null;
  const role = roleForLint[lint.name];
  const metadata = lint.metadata;
  if (
    !metadata ||
    metadata.schema !== "public" ||
    metadata.security_definer !== true
  )
    return null;
  const args = normalizeArguments(metadata.arguments);
  if (args === null) return null;
  return (
    reviewedSecurityDefiners.find(
      entry =>
        entry.name === metadata.name &&
        normalizeArguments(entry.arguments) === args &&
        entry.roles.includes(role),
    ) || null
  );
}

// The Management API may return individual lints or groups with findings.
// An empty/malformed group is retained and fails closed in strict mode.
export function expandSecurityAdvisories(lints) {
  if (!Array.isArray(lints)) return [];
  return lints.flatMap(lint =>
    Array.isArray(lint?.findings) && lint.findings.length > 0
      ? lint.findings.map(finding => ({ ...lint, ...finding }))
      : [lint],
  );
}
