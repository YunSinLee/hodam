import { describe, expect, it } from "vitest";

import {
  getSignInRecoveryHint,
  parseSignInRecoveryCode,
} from "@/lib/auth/sign-in-recovery";

describe("parseSignInRecoveryCode", () => {
  it("parses valid codes", () => {
    expect(parseSignInRecoveryCode("expired_code")).toBe("expired_code");
    expect(parseSignInRecoveryCode("TIMEOUT")).toBe("timeout");
  });

  it("returns null for unknown/empty values", () => {
    expect(parseSignInRecoveryCode("")).toBeNull();
    expect(parseSignInRecoveryCode("unknown_code")).toBeNull();
    expect(parseSignInRecoveryCode(null)).toBeNull();
  });
});

describe("getSignInRecoveryHint", () => {
  it("returns hint for known code", () => {
    expect(getSignInRecoveryHint("invalid_request")).toContain(
      "OAuth 요청 정보",
    );
  });

  it("returns null for unknown code", () => {
    expect(getSignInRecoveryHint("nope")).toBeNull();
  });
});
