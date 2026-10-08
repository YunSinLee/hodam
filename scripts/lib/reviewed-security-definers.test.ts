import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  expandSecurityAdvisories,
  reviewedDefinerForAdvisory,
  reviewedSecurityDefiners,
} from "./reviewed-security-definers.mjs";

function advisory(
  name = "get_thread_detail",
  args = "p_thread_id bigint",
  role = "authenticated",
) {
  return {
    name: `${role}_security_definer_function_executable`,
    level: "WARN",
    detail: "Synthetic security advisory",
    metadata: {
      schema: "public",
      name,
      arguments: args,
      security_definer: true,
    },
  };
}

describe("reviewed SECURITY DEFINER signatures", () => {
  it("recognizes only the seven reviewed signatures and nine role grants", () => {
    expect(reviewedSecurityDefiners).toHaveLength(7);
    const grants = reviewedSecurityDefiners.flatMap(entry =>
      entry.roles.map(role => advisory(entry.name, entry.arguments, role)),
    );
    expect(grants).toHaveLength(9);
    grants.forEach(lint =>
      expect(reviewedDefinerForAdvisory(lint)).not.toBeNull(),
    );
  });

  it.each([
    advisory("future_unsafe_function", ""),
    advisory("get_thread_detail", "p_thread_id text"),
    advisory("get_thread_detail", "p_thread_id bigint", "anon"),
    advisory("register_webhook_transmission", "p_transmission_id text"),
    {
      ...advisory(),
      metadata: { ...advisory().metadata, schema: "other_schema" },
    },
    { ...advisory(), metadata: undefined },
    {
      ...advisory(),
      metadata: { ...advisory().metadata, arguments: undefined },
    },
    { ...advisory(), level: "ERROR" },
    { ...advisory(), name: "function_search_path_mutable" },
  ])("fails closed for unknown or stronger advisory %j", lint => {
    expect(reviewedDefinerForAdvisory(lint)).toBeNull();
  });

  it("examines every grouped finding, including an unknown function in a known lint category", () => {
    const safe = advisory();
    const unsafe = advisory("future_unsafe_function", "");
    const results = expandSecurityAdvisories([
      { ...safe, findings: [safe, unsafe] },
    ]);
    expect(results).toHaveLength(2);
    expect(reviewedDefinerForAdvisory(results[0])).not.toBeNull();
    expect(reviewedDefinerForAdvisory(results[1])).toBeNull();
  });
});

describe("strict security CLI", () => {
  function run(lints: unknown[], ignore = "") {
    const directory = mkdtempSync(
      path.join(tmpdir(), "hodam-security-advisory-"),
    );
    try {
      const preload = path.join(directory, "mock-fetch.mjs");
      writeFileSync(
        preload,
        `
        globalThis.fetch = async target => {
          const url = new URL(String(target));
          if (url.origin !== 'https://api.supabase.com') throw new Error('Unexpected network');
          if (url.pathname.endsWith('/advisors/security')) return Response.json(${JSON.stringify(lints)});
          if (url.pathname.endsWith('/config/auth')) return Response.json({mailer_otp_exp:3600, security_password_hibp_enabled:true});
          throw new Error('Unexpected endpoint');
        };
      `,
      );
      return spawnSync(
        process.execPath,
        [
          "--import",
          preload,
          path.join(process.cwd(), "scripts/check-supabase-security.mjs"),
          "--strict",
          "--skip-db",
          "--skip-auth",
        ],
        {
          cwd: directory,
          env: {
            NODE_ENV: "test",
            NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.invalid",
            SUPABASE_ACCESS_TOKEN: "synthetic-token",
            SUPABASE_PROJECT_REF: "synthetic-project",
            HODAM_SUPABASE_SECURITY_IGNORE_LINTS: ignore,
          },
          encoding: "utf8",
          timeout: 10000,
        },
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it("reports exact reviewed functions as reviewed, not ignored", () => {
    const result = run([advisory()]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "reviewed public.get_thread_detail(p_thread_id bigint)",
    );
    expect(result.stdout).not.toContain("ignored by configuration");
  });

  it("still fails strict mode for a new function even with a blanket ignore request", () => {
    const result = run(
      [advisory("future_unsafe_function", "")],
      "authenticated_security_definer_function_executable",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Supabase security check failed");
  });

  it("fails a mixed grouped response rather than accepting the entire category", () => {
    const safe = advisory();
    const unsafe = advisory("handle_new_user", "");
    const result = run([{ ...safe, findings: [safe, unsafe] }]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("reviewed public.get_thread_detail");
    expect(result.stderr).toContain("1 failures");
  });
});
