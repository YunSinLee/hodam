import { describe, expect, it } from "vitest";

import {
  getMissingTestUserCredentialsMessage,
  resolveTestUserCredentials,
} from "./test-user-credentials.mjs";

describe("resolveTestUserCredentials", () => {
  it("uses primary credentials when both are provided", () => {
    const resolved = resolveTestUserCredentials({
      primaryEmail: "primary@example.com",
      primaryPassword: "primary-pass",
      fallbackEmail: "fallback@example.com",
      fallbackPassword: "fallback-pass",
    });

    expect(resolved).toEqual({
      email: "primary@example.com",
      password: "primary-pass",
      isConfigured: true,
      source: "primary",
    });
  });

  it("uses fallback credentials when primary is missing", () => {
    const resolved = resolveTestUserCredentials({
      fallbackEmail: "fallback@example.com",
      fallbackPassword: "fallback-pass",
    });

    expect(resolved).toEqual({
      email: "fallback@example.com",
      password: "fallback-pass",
      isConfigured: true,
      source: "fallback",
    });
  });

  it("returns missing state when only partial credentials are present", () => {
    const resolved = resolveTestUserCredentials({
      primaryEmail: "primary@example.com",
      primaryPassword: "",
      fallbackEmail: "",
      fallbackPassword: "",
    });

    expect(resolved.isConfigured).toBe(false);
    expect(resolved.source).toBe("missing");
  });

  it("uses generated defaults when auto mode is enabled and no credentials are provided", () => {
    const resolved = resolveTestUserCredentials({
      allowGeneratedDefaults: true,
    });

    expect(resolved).toEqual({
      email: "hodam.e2e.default@example.com",
      password: "HodamE2E!Passw0rd",
      isConfigured: true,
      source: "generated_default",
    });
  });

  it("keeps missing state when partial credentials are present in auto mode", () => {
    const resolved = resolveTestUserCredentials({
      primaryEmail: "partial@example.com",
      allowGeneratedDefaults: true,
    });

    expect(resolved.isConfigured).toBe(false);
    expect(resolved.source).toBe("missing");
  });
});

describe("getMissingTestUserCredentialsMessage", () => {
  it("mentions both primary and fallback test-user env names", () => {
    const message = getMissingTestUserCredentialsMessage();
    expect(message).toContain("HODAM_TEST_USER_EMAIL");
    expect(message).toContain("HODAM_TEST_DEFAULT_USER_EMAIL");
    expect(message).toContain("HODAM_TEST_AUTO_USER");
  });
});
