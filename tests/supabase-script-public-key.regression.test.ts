import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
// Execute the real CLIs in an empty directory with synthetic environment values.
// The preload replaces every fetch; no production credentials or network are used.
const mockFetch = `
globalThis.fetch = async (target, options = {}) => {
  const url = new URL(String(target));
  if (url.origin !== "https://example.supabase.invalid") throw new Error("Unexpected network destination");
  const headers = new Headers(options.headers);
  if (headers.has("authorization")) throw new Error("API keys must not be sent as user bearer tokens");
  if (headers.get("apikey") !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Missing API key");
  if (url.pathname === "/auth/v1/settings") return Response.json({ external: { google: true, kakao: true } });
  if (url.pathname === "/auth/v1/authorize") return new Response(null, { status: 302, headers: { location: "https://identity.example/authorize" } });
  if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "synthetic-access-token" });
  if (url.pathname.endsWith("/get_auth_callback_metrics_by_attempt")) return Response.json([]);
  if (url.pathname.endsWith("/record_auth_callback_metric")) return Response.json(true);
  if (url.pathname.endsWith("/handle_new_user")) throw new Error("Trigger functions are not exposed as PostgREST RPCs; verify their DB grants instead");
  if (url.pathname.startsWith("/rest/v1/rpc/")) return Response.json({ message: "permission denied" }, { status: 403 });
  throw new Error("Unexpected mocked endpoint");
};
`;

describe.each(["legacy-anon-test-key", "sb_publishable_synthetic_test_key"])(
  "public Supabase CLI key compatibility: %s",
  publicKey => {
    it.each([
      ["get-test-access-token.mjs", [], "synthetic-access-token"],
      [
        "check-oauth.mjs",
        [],
        "Passed: OAuth provider authorize checks look healthy.",
      ],
      [
        "check-supabase-security.mjs",
        ["--skip-management"],
        "Supabase security check passed",
      ],
    ] as const)(
      "runs %s without treating the API key as a user JWT",
      (script, args, expected) => {
        const directory = mkdtempSync(
          path.join(tmpdir(), "hodam-public-key-test-"),
        );
        try {
          const preload = path.join(directory, "mock-fetch.mjs");
          writeFileSync(preload, mockFetch);
          const output = execFileSync(
            process.execPath,
            ["--import", preload, path.join(root, "scripts", script), ...args],
            {
              cwd: directory,
              env: {
                NODE_ENV: "test",
                NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.invalid",
                NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
                HODAM_TEST_USER_EMAIL: "synthetic@example.invalid",
                HODAM_TEST_USER_PASSWORD: "synthetic-password",
              },
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
              timeout: 10000,
            },
          );
          expect(output).toContain(expected);
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      },
    );
  },
);
