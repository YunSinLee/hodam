import { describe, expect, it } from "vitest";

import {
  isCiLikeEnvironment,
  shouldRequireAuthFlow,
} from "./auth-e2e-utils.mjs";

describe("auth-e2e-utils", () => {
  it("detects CI-like environment from CI flag", () => {
    expect(isCiLikeEnvironment({ CI: "true" })).toBe(true);
    expect(isCiLikeEnvironment({ CI: "1" })).toBe(true);
    expect(isCiLikeEnvironment({ CI: "false" })).toBe(false);
  });

  it("detects CI-like environment from GITHUB_ACTIONS flag", () => {
    expect(isCiLikeEnvironment({ GITHUB_ACTIONS: "true" })).toBe(true);
    expect(isCiLikeEnvironment({ GITHUB_ACTIONS: "1" })).toBe(true);
    expect(isCiLikeEnvironment({ GITHUB_ACTIONS: "false" })).toBe(false);
  });

  it("prefers explicit require-auth value when provided", () => {
    expect(
      shouldRequireAuthFlow({
        explicitValue: "1",
        processEnv: { CI: "false" },
      }),
    ).toBe(true);

    expect(
      shouldRequireAuthFlow({
        explicitValue: "0",
        processEnv: { CI: "true" },
      }),
    ).toBe(false);
  });

  it("falls back to CI detection when explicit value is missing", () => {
    expect(
      shouldRequireAuthFlow({
        explicitValue: "",
        processEnv: { CI: "true" },
      }),
    ).toBe(true);

    expect(
      shouldRequireAuthFlow({
        explicitValue: "",
        processEnv: { CI: "false", GITHUB_ACTIONS: "false" },
      }),
    ).toBe(false);
  });

  it("treats invalid explicit values as unspecified", () => {
    expect(
      shouldRequireAuthFlow({
        explicitValue: "maybe",
        processEnv: { CI: "true" },
      }),
    ).toBe(true);
  });
});

