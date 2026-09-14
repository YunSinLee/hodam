import { describe, expect, it } from "vitest";

import {
  parseOAuthCallbackPayload,
  resolveOAuthCodeExchangeAction,
} from "@/lib/auth/callback-flow";

describe("parseOAuthCallbackPayload", () => {
  it("parses code callback payload from query params", () => {
    const payload = parseOAuthCallbackPayload(
      new URL("http://localhost:3000/auth/callback?code=test-code"),
    );

    expect(payload.code).toBe("test-code");
    expect(payload.hasCode).toBe(true);
    expect(payload.hasTokenPair).toBe(false);
    expect(payload.hasCallbackPayload).toBe(true);
    expect(payload.oauthError).toBeNull();
  });

  it("parses token callback payload from hash params", () => {
    const payload = parseOAuthCallbackPayload(
      new URL(
        "http://localhost:3000/auth/callback#access_token=at&refresh_token=rt",
      ),
    );

    expect(payload.accessTokenFromHash).toBe("at");
    expect(payload.refreshTokenFromHash).toBe("rt");
    expect(payload.hasCode).toBe(false);
    expect(payload.hasTokenPair).toBe(true);
    expect(payload.hasCallbackPayload).toBe(true);
  });

  it("prefers error_description from query params", () => {
    const payload = parseOAuthCallbackPayload(
      new URL(
        "http://localhost:3000/auth/callback?error_description=provider_failed#error=hash_error",
      ),
    );

    expect(payload.oauthError).toBe("provider_failed");
    expect(payload.hasCallbackPayload).toBe(true);
  });

  it("parses invalid_grant expiry callback payload", () => {
    const payload = parseOAuthCallbackPayload(
      new URL(
        "http://localhost:3000/auth/callback?error=invalid_grant&error_description=authorization%20code%20expired",
      ),
    );

    expect(payload.oauthError).toBe("authorization code expired");
    expect(payload.hasCallbackPayload).toBe(true);
    expect(payload.hasCode).toBe(false);
    expect(payload.hasTokenPair).toBe(false);
  });

  it("uses hash error_description when query error fields are absent", () => {
    const payload = parseOAuthCallbackPayload(
      new URL(
        "http://localhost:3000/auth/callback#error_description=authorization%20code%20already%20been%20used",
      ),
    );

    expect(payload.oauthError).toBe("authorization code already been used");
    expect(payload.hasCallbackPayload).toBe(true);
  });
});

describe("resolveOAuthCodeExchangeAction", () => {
  it("returns none when code is missing", () => {
    const action = resolveOAuthCodeExchangeAction({
      hasSession: false,
      code: null,
      hasRecentCodeMarker: false,
    });

    expect(action).toBe("none");
  });

  it("returns none when session already exists", () => {
    const action = resolveOAuthCodeExchangeAction({
      hasSession: true,
      code: "abc",
      hasRecentCodeMarker: false,
    });

    expect(action).toBe("none");
  });

  it("waits for existing exchange when marker is present", () => {
    const action = resolveOAuthCodeExchangeAction({
      hasSession: false,
      code: "abc",
      hasRecentCodeMarker: true,
    });

    expect(action).toBe("wait_for_existing_exchange");
  });

  it("exchanges code when marker is absent", () => {
    const action = resolveOAuthCodeExchangeAction({
      hasSession: false,
      code: "abc",
      hasRecentCodeMarker: false,
    });

    expect(action).toBe("exchange_now");
  });
});
