#!/usr/bin/env node

import path from "path";

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv, readEnvValue } from "./lib/env-loader.mjs";

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict");
const skipDb = args.has("--skip-db");
const skipAuth = args.has("--skip-auth");
const skipManagement = args.has("--skip-management");
const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV || "development";

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

const { merged: localEnv, loaded: loadedFilePaths } = loadLocalEnv({
  cwd,
  nodeEnv,
});
const loadedFiles = loadedFilePaths.map(fullPath => path.basename(fullPath));

function readEnv(name) {
  return readEnvValue(name, {
    processEnv: process.env,
    fileEnv: localEnv,
  });
}

function parseCsvValues(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

const ignoredIssueNames = new Set([
  ...parseCsvValues(readEnv("HODAM_SUPABASE_SECURITY_IGNORE_LINTS")),
  ...parseCsvValues(readArgValue("--ignore-lints")),
]);

function isIgnoredIssue(issueName) {
  return ignoredIssueNames.has(issueName);
}

const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
const projectRef =
  readEnv("SUPABASE_PROJECT_REF") ||
  (() => {
    try {
      const host = new URL(supabaseUrl).hostname;
      if (!host.endsWith(".supabase.co")) return "";
      return host.split(".")[0] || "";
    } catch {
      return "";
    }
  })();

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

function safeJsonParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function pickValue(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return obj[key];
    }
  }
  return undefined;
}

function normalizeText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? "");
}

function normalizeRemediation(lint) {
  const remediation = String(lint?.remediation || "").trim();
  if (!remediation) return "";
  return remediation;
}

function isExpectedDeniedResponse(status, body) {
  if (status === 401 || status === 403) return true;
  const text = normalizeText(body).toLowerCase();
  return (
    text.includes("permission denied") ||
    text.includes("insufficient_privilege") ||
    text.includes("not authorized") ||
    text.includes("not allowed") ||
    text.includes("invalid jwt")
  );
}

async function main() {
  let failed = 0;
  let warned = 0;
  let executedChecks = 0;
  const advisorLintNames = new Set();
  const ignoredAdvisoriesRequiringManualAction = [];

  const markFail = message => {
    failed += 1;
    console.error(`✗ ${message}`);
  };

  const markWarn = message => {
    warned += 1;
    console.warn(`! ${message}`);
  };

  const markOk = message => {
    console.log(`✓ ${message}`);
  };

  console.log("HODAM Supabase security check");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );
  console.log(`- strict mode: ${strictMode}`);
  console.log(
    `- check groups: db=${!skipDb} auth=${!skipAuth} management=${!skipManagement}`,
  );
  if (ignoredIssueNames.size > 0) {
    console.log(`- ignored issues: ${Array.from(ignoredIssueNames).join(", ")}`);
  }

  if (!skipDb) {
    if (!supabaseAnonKey) {
      markWarn(
        "Skipping anon RPC boundary checks: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
      );
    } else {
      executedChecks += 1;
      const rpcChecks = [
        {
          fn: "consume_beads",
          args: {
            p_user_id: "00000000-0000-0000-0000-000000000000",
            p_cost: 1,
            p_request_id: "security_smoke_anon",
          },
        },
        {
          fn: "finalize_payment",
          args: {
            p_order_id: "security-smoke-order",
            p_payment_key: "security-smoke-key",
            p_user_id: "00000000-0000-0000-0000-000000000000",
          },
        },
        {
          fn: "get_my_threads",
          args: {},
        },
        {
          fn: "get_thread_detail",
          args: {
            p_thread_id: 1,
          },
        },
      ];

      for (const rpcCheck of rpcChecks) {
        const url = `${supabaseUrl}/rest/v1/rpc/${rpcCheck.fn}`;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(rpcCheck.args),
          });
          const rawText = await response.text();
          const parsed = safeJsonParse(rawText);
          const body = parsed ?? rawText;

          if (response.ok) {
            markFail(
              `db:anon_rpc_${rpcCheck.fn} unexpectedly executable by anon role`,
            );
            continue;
          }

          if (isExpectedDeniedResponse(response.status, body)) {
            markOk(`db:anon_rpc_${rpcCheck.fn} blocked`);
            continue;
          }

          markFail(
            `db:anon_rpc_${rpcCheck.fn} unexpected rejection (${response.status}): ${normalizeText(body).slice(0, 220)}`,
          );
        } catch (error) {
          markFail(
            error instanceof Error
              ? `db:anon_rpc_${rpcCheck.fn} check failed: ${error.message}`
              : `db:anon_rpc_${rpcCheck.fn} check failed: ${String(error)}`,
          );
        }
      }

      const anonAllowedRpcChecks = [
        {
          fn: "get_auth_callback_metrics_by_attempt",
          args: {
            p_attempt_id: "security-smoke-attempt",
            p_limit: 1,
          },
        },
        {
          fn: "record_auth_callback_metric",
          args: {
            p_stage: "flow_start",
            p_callback_path: "/auth/callback",
            p_timestamp_ms: Date.now(),
            p_details: {
              source: "security_smoke",
              oauthAttemptId: "security-smoke-attempt",
            },
          },
        },
      ];

      for (const rpcCheck of anonAllowedRpcChecks) {
        const url = `${supabaseUrl}/rest/v1/rpc/${rpcCheck.fn}`;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(rpcCheck.args),
          });
          const rawText = await response.text();
          const parsed = safeJsonParse(rawText);
          const body = parsed ?? rawText;

          if (response.ok) {
            markOk(`db:anon_rpc_${rpcCheck.fn} allowed`);
            continue;
          }

          markFail(
            `db:anon_rpc_${rpcCheck.fn} unexpectedly blocked (${response.status}): ${normalizeText(body).slice(0, 220)}`,
          );
        } catch (error) {
          markFail(
            error instanceof Error
              ? `db:anon_rpc_${rpcCheck.fn} check failed: ${error.message}`
              : `db:anon_rpc_${rpcCheck.fn} check failed: ${String(error)}`,
          );
        }
      }
    }

    if (!serviceRoleKey) {
      if (isIgnoredIssue("missing_service_role_key")) {
        markOk(
          "db: Skipping DB RPC smoke checks (SUPABASE_SERVICE_ROLE_KEY missing, ignored by configuration)",
        );
      } else {
        markWarn(
          "Skipping DB RPC smoke checks: SUPABASE_SERVICE_ROLE_KEY is missing.",
        );
      }
    } else {
      executedChecks += 1;
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });

      const runRpcCheck = async functionName => {
        const { data, error } = await supabase.rpc(functionName);
        if (error) {
          if (String(error.message || "").includes("does not exist")) {
            throw new Error(
              `${functionName} RPC is missing. Apply latest Supabase migrations first.`,
            );
          }
          throw new Error(`${functionName} RPC failed: ${error.message}`);
        }
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(`${functionName} RPC returned no checks`);
        }
        return data;
      };

      try {
        const baseChecks = await runRpcCheck("hodam_security_smoke_check");
        const grantChecks = await runRpcCheck("hodam_security_grants_smoke_check");
        const integrityChecks = await runRpcCheck(
          "hodam_security_integrity_smoke_check",
        );
        const checks = [...baseChecks, ...grantChecks, ...integrityChecks];

        for (const row of checks) {
          const checkName = String(row.check_name || "unknown");
          const ok = Boolean(row.ok);
          const detail = String(row.detail || "");
          if (ok) {
            markOk(`db:${checkName}${detail ? ` (${detail})` : ""}`);
          } else {
            markFail(`db:${checkName}${detail ? ` (${detail})` : ""}`);
          }
        }
      } catch (error) {
        markFail(
          error instanceof Error
            ? `DB smoke check failed: ${error.message}`
            : `DB smoke check failed: ${String(error)}`,
        );
      }
    }
  }

  if (!skipAuth) {
    if (!supabaseAnonKey) {
      markWarn(
        "Skipping auth provider checks: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
      );
    } else {
      executedChecks += 1;
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          method: "GET",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        });

        const bodyText = await response.text();
        const body = safeJsonParse(bodyText);

        if (!response.ok || !body || typeof body !== "object") {
          markFail(
            `Auth settings request failed (${response.status}): ${bodyText.slice(0, 300)}`,
          );
        } else {
          const external = body.external && typeof body.external === "object"
            ? body.external
            : {};

          ["google", "kakao"].forEach(provider => {
            const value = external[provider];
            if (value !== true) {
              markFail(`auth: provider ${provider} is not enabled`);
            } else {
              markOk(`auth: provider ${provider} enabled`);
            }
          });
        }
      } catch (error) {
        markFail(
          error instanceof Error
            ? `Auth settings check failed: ${error.message}`
            : `Auth settings check failed: ${String(error)}`,
        );
      }
    }
  }

  if (!skipManagement) {
    if (!accessToken || !projectRef) {
      if (isIgnoredIssue("missing_management_credentials")) {
        markOk(
          "management: Skipping Management API checks (credentials missing, ignored by configuration)",
        );
      } else {
        markWarn(
          "Skipping Management API checks: SUPABASE_ACCESS_TOKEN and/or SUPABASE_PROJECT_REF missing.",
        );
      }
    } else {
      executedChecks += 1;
      const managementHeaders = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      try {
        const securityRes = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/advisors/security`,
          {
            method: "GET",
            headers: managementHeaders,
          },
        );

        const securityRaw = await securityRes.text();
        const securityJson = safeJsonParse(securityRaw);

        if (!securityRes.ok) {
          markFail(
            `management: advisors/security failed (${securityRes.status}): ${securityRaw.slice(0, 400)}`,
          );
        } else {
          const lints = toArray(
            securityJson?.result?.lints || securityJson?.lints || securityJson,
          );

          if (lints.length === 0) {
            markWarn("management: advisors/security returned no lints");
          } else {
            for (const lint of lints) {
              const level = String(lint?.level || "INFO").toUpperCase();
              const name = String(lint?.name || "unknown");
              const detail = String(lint?.detail || lint?.description || "");
              const remediation = normalizeRemediation(lint);
              advisorLintNames.add(name);
              if (isIgnoredIssue(name)) {
                markOk(`management:${name}[${level}] ignored by configuration`);
                if (level === "WARN" || level === "ERROR") {
                  ignoredAdvisoriesRequiringManualAction.push({
                    name,
                    level,
                    detail,
                    remediation,
                  });
                }
                continue;
              }
              if (level === "WARN" || level === "ERROR") {
                if (strictMode) {
                  markFail(`management:${name}[${level}] ${detail}`);
                } else {
                  markWarn(`management:${name}[${level}] ${detail}`);
                }
              } else {
                markOk(`management:${name}[${level}]`);
              }
            }
          }
        }
      } catch (error) {
        markFail(
          error instanceof Error
            ? `Management security advisor check failed: ${error.message}`
            : `Management security advisor check failed: ${String(error)}`,
        );
      }

      try {
        const authConfigRes = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
          {
            method: "GET",
            headers: managementHeaders,
          },
        );

        const authConfigRaw = await authConfigRes.text();
        const authConfig = safeJsonParse(authConfigRaw);

        if (!authConfigRes.ok || !authConfig || typeof authConfig !== "object") {
          markWarn(
            `management: config/auth check skipped (${authConfigRes.status})`,
          );
        } else {
          const otpExpiryValue = pickValue(authConfig, [
            "mailer_otp_exp",
            "mailer_otp_expiry",
            "otp_exp",
          ]);
          const leakedPasswordProtectionValue = pickValue(authConfig, [
            "security_password_hibp_enabled",
            "password_hibp_enabled",
            "password_leaked_protection_enabled",
          ]);

          if (typeof otpExpiryValue === "number") {
            if (otpExpiryValue > 3600) {
              if (isIgnoredIssue("auth_otp_long_expiry")) {
                markOk(
                  `management: OTP expiry too long (${otpExpiryValue}s > 3600s, ignored by configuration)`,
                );
              } else {
              const alreadyReportedByAdvisor =
                advisorLintNames.has("auth_otp_long_expiry");
              if (alreadyReportedByAdvisor) {
                markOk(
                  `management: OTP expiry too long (${otpExpiryValue}s > 3600s, already reported by advisor)`,
                );
              } else {
                if (strictMode) {
                  markFail(
                    `management: OTP expiry too long (${otpExpiryValue}s > 3600s)`,
                  );
                } else {
                  markWarn(
                    `management: OTP expiry too long (${otpExpiryValue}s > 3600s)`,
                  );
                }
              }
              }
            } else {
              markOk(`management: OTP expiry is ${otpExpiryValue}s`);
            }
          } else {
            markWarn(
              "management: Could not infer OTP expiry from config/auth response",
            );
          }

          if (typeof leakedPasswordProtectionValue === "boolean") {
            if (!leakedPasswordProtectionValue) {
              if (isIgnoredIssue("auth_leaked_password_protection")) {
                markOk(
                  "management: leaked password protection is disabled (ignored by configuration)",
                );
              } else {
              const alreadyReportedByAdvisor = advisorLintNames.has(
                "auth_leaked_password_protection",
              );
              if (alreadyReportedByAdvisor) {
                markOk(
                  "management: leaked password protection is disabled (already reported by advisor)",
                );
              } else {
                if (strictMode) {
                  markFail(
                    "management: leaked password protection is disabled",
                  );
                } else {
                  markWarn(
                    "management: leaked password protection is disabled",
                  );
                }
              }
              }
            } else {
              markOk("management: leaked password protection enabled");
            }
          } else {
            markWarn(
              "management: Could not infer leaked password protection setting",
            );
          }
        }
      } catch (error) {
        markWarn(
          error instanceof Error
            ? `Management auth config check failed: ${error.message}`
            : `Management auth config check failed: ${String(error)}`,
        );
      }
    }
  }

  console.log("");
  if (executedChecks === 0) {
    console.error(
      "Supabase security check failed: no checks executed (provide required credentials).",
    );
    process.exit(1);
  }

  if (failed > 0) {
    console.error(
      `Supabase security check failed: ${failed} failures, ${warned} warnings.`,
    );
    process.exit(1);
  }

  if (ignoredAdvisoriesRequiringManualAction.length > 0) {
    console.log("");
    console.log("Ignored advisories that still need manual remediation:");
    ignoredAdvisoriesRequiringManualAction.forEach(item => {
      const summary = `${item.name}[${item.level}] ${
        item.detail || "See advisor detail."
      }`;
      if (item.remediation) {
        console.log(`- ${summary} | remediation: ${item.remediation}`);
      } else {
        console.log(`- ${summary}`);
      }
    });
  }

  if (warned > 0) {
    console.log(
      `Supabase security check passed with warnings: ${warned}.`,
    );
    if (strictMode) {
      process.exit(1);
    }
    process.exit(0);
  }

  console.log("Supabase security check passed.");
}

main().catch(error => {
  console.error(
    "Supabase security check failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
