import { describe, expect, it } from "vitest";

import {
  collectWebhookE2EMissingEnv,
  createAccessTokenMeta,
  shouldEnsureTestUser,
} from "./payments-webhook-runner-utils.mjs";

describe("createAccessTokenMeta", () => {
  it("prefers explicit env token", () => {
    const meta = createAccessTokenMeta({
      explicitToken: "token-from-env",
      scriptStatus: 1,
      scriptStderr: "script failed",
    });

    expect(meta).toEqual({
      token: "token-from-env",
      source: "env",
      reason: "",
    });
  });

  it("returns failure reason when token script fails", () => {
    const meta = createAccessTokenMeta({
      scriptStatus: 1,
      scriptStderr: "missing credentials",
    });

    expect(meta.token).toBe("");
    expect(meta.source).toBe("script");
    expect(meta.reason).toContain("missing credentials");
  });

  it("returns empty-token reason when script output is empty", () => {
    const meta = createAccessTokenMeta({
      scriptStatus: 0,
      scriptStdout: "   ",
    });

    expect(meta.reason).toBe("empty token output");
  });
});

describe("collectWebhookE2EMissingEnv", () => {
  it("lists all required missing values", () => {
    const missing = collectWebhookE2EMissingEnv();
    expect(missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "HODAM_TEST_ACCESS_TOKEN",
    ]);
  });

  it("returns empty when all required values are present", () => {
    const missing = collectWebhookE2EMissingEnv({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      serviceRoleKey: "service-role",
      accessToken: "access-token",
    });
    expect(missing).toEqual([]);
  });

  it("can skip service role requirement in optional mode", () => {
    const missing = collectWebhookE2EMissingEnv({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      serviceRoleKey: "",
      accessToken: "access-token",
      requireServiceRole: false,
    });
    expect(missing).toEqual([]);
  });

  it("can skip access token requirement in optional mode", () => {
    const missing = collectWebhookE2EMissingEnv({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      serviceRoleKey: "",
      accessToken: "",
      requireServiceRole: false,
      requireAccessToken: false,
    });
    expect(missing).toEqual([]);
  });
});

describe("shouldEnsureTestUser", () => {
  it("returns true only when both email and password are provided", () => {
    expect(
      shouldEnsureTestUser({
        email: "test@example.com",
        password: "secret",
      }),
    ).toBe(true);
    expect(shouldEnsureTestUser({ email: "test@example.com", password: "" })).toBe(
      false,
    );
    expect(shouldEnsureTestUser({ email: "", password: "secret" })).toBe(false);
  });
});
