export const AUTH_CALLBACK_METRIC_STAGES = [
  "flow_start",
  "payload_parsed",
  "oauth_error",
  "no_payload_session_check_start",
  "no_payload_session_recovered",
  "wait_for_session_start",
  "wait_for_session_complete",
  "exchange_start",
  "exchange_complete",
  "exchange_terminal_error",
  "set_session_start",
  "set_session_complete",
  "callback_success",
  "callback_error",
  "fallback_timeout_triggered",
] as const;

export type AuthCallbackMetricStage =
  (typeof AUTH_CALLBACK_METRIC_STAGES)[number];

export const AUTH_CALLBACK_METRIC_STAGE_SET = new Set<string>(
  AUTH_CALLBACK_METRIC_STAGES,
);

export interface AuthCallbackMetricPayload {
  stage: AuthCallbackMetricStage;
  callbackPath: string;
  timestampMs: number;
  details?: Record<string, unknown>;
}
