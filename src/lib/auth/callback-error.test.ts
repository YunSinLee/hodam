import { describe, expect, it } from "vitest";

import {
  formatSessionErrorMessage,
  isRecoverableSessionExchangeError,
  isTerminalSessionExchangeError,
  toSignInRecoveryCode,
} from "@/lib/auth/callback-error";

describe("formatSessionErrorMessage", () => {
  it("returns default message when error message is empty", () => {
    expect(formatSessionErrorMessage(null)).toBe(
      "로그인 세션을 찾을 수 없습니다.",
    );
  });

  it("returns code verifier guidance", () => {
    expect(
      formatSessionErrorMessage(
        "Both auth code and code verifier should be non-empty",
      ),
    ).toBe(
      "로그인 검증 정보가 만료되어 세션을 복구하지 못했습니다. 다시 로그인해주세요.",
    );
  });

  it("returns timeout guidance", () => {
    expect(formatSessionErrorMessage("initialSession timeout (45000ms)")).toBe(
      "로그인 응답이 지연되어 세션을 복구하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  });

  it("returns invalid grant guidance", () => {
    expect(
      formatSessionErrorMessage("invalid_grant: authorization code expired"),
    ).toBe(
      "로그인 인증 코드가 만료되었거나 이미 사용되었습니다. 로그인 페이지에서 다시 시도해주세요.",
    );
  });

  it("returns expired-code guidance for reused authorization code", () => {
    expect(
      formatSessionErrorMessage("authorization code has already been used"),
    ).toBe(
      "로그인 인증 코드가 만료되었거나 이미 사용되었습니다. 로그인 페이지에서 다시 시도해주세요.",
    );
  });

  it("returns invalid request guidance", () => {
    expect(
      formatSessionErrorMessage("invalid request: redirect uri mismatch"),
    ).toBe(
      "로그인 요청 정보가 유효하지 않습니다. 로그인 페이지에서 다시 시도해주세요.",
    );
  });
});

describe("isTerminalSessionExchangeError", () => {
  it("returns true for code verifier errors", () => {
    expect(
      isTerminalSessionExchangeError(
        "Both auth code and code verifier should be non-empty",
      ),
    ).toBe(true);
  });

  it("returns true for invalid grant errors", () => {
    expect(
      isTerminalSessionExchangeError(
        "invalid_grant: authorization code expired",
      ),
    ).toBe(true);
  });

  it("returns true for already-used code and invalid-request errors", () => {
    expect(
      isTerminalSessionExchangeError(
        "authorization code has already been used",
      ),
    ).toBe(true);
    expect(
      isTerminalSessionExchangeError("invalid request: missing code verifier"),
    ).toBe(true);
  });

  it("returns false for empty/unknown messages", () => {
    expect(isTerminalSessionExchangeError("")).toBe(false);
    expect(isTerminalSessionExchangeError(null)).toBe(false);
    expect(isTerminalSessionExchangeError("network timeout")).toBe(false);
  });
});

describe("isRecoverableSessionExchangeError", () => {
  it("returns true for already-used authorization code", () => {
    expect(
      isRecoverableSessionExchangeError(
        "authorization code has already been used",
      ),
    ).toBe(true);
  });

  it("returns true for invalid_grant authorization code conflicts", () => {
    expect(
      isRecoverableSessionExchangeError(
        "invalid_grant: authorization code has already been used",
      ),
    ).toBe(true);
  });

  it("returns false for non-recoverable exchange errors", () => {
    expect(
      isRecoverableSessionExchangeError(
        "Both auth code and code verifier should be non-empty",
      ),
    ).toBe(false);
    expect(
      isRecoverableSessionExchangeError("invalid_grant: refresh token expired"),
    ).toBe(false);
  });
});

describe("toSignInRecoveryCode", () => {
  it("maps access denied errors", () => {
    expect(toSignInRecoveryCode("access_denied by user")).toBe("access_denied");
  });

  it("maps code/session expiry errors", () => {
    expect(toSignInRecoveryCode("invalid_grant: code expired")).toBe(
      "expired_code",
    );
    expect(
      toSignInRecoveryCode("authorization code has already been used"),
    ).toBe("expired_code");
    expect(toSignInRecoveryCode("refresh token expired")).toBe("expired_code");
    expect(
      toSignInRecoveryCode(
        "Both auth code and code verifier should be non-empty",
      ),
    ).toBe("expired_code");
  });

  it("maps invalid request and timeout", () => {
    expect(toSignInRecoveryCode("invalid request")).toBe("invalid_request");
    expect(toSignInRecoveryCode("session timeout")).toBe("timeout");
  });

  it("falls back to callback_failed", () => {
    expect(toSignInRecoveryCode("unknown")).toBe("callback_failed");
    expect(toSignInRecoveryCode(null)).toBe("callback_failed");
  });
});
