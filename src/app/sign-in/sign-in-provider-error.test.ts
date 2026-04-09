import { describe, expect, it } from "vitest";

import {
  buildSignInProviderErrorMessage,
  extractOAuthAttemptId,
} from "@/app/sign-in/sign-in-provider-error";

describe("extractOAuthAttemptId", () => {
  it("returns attempt id when error has oauthAttemptId", () => {
    expect(
      extractOAuthAttemptId({
        oauthAttemptId: "attempt-1",
      }),
    ).toBe("attempt-1");
  });

  it("returns null when attempt id is missing", () => {
    expect(extractOAuthAttemptId(new Error("oauth failed"))).toBeNull();
    expect(extractOAuthAttemptId("oauth failed")).toBeNull();
  });
});

describe("buildSignInProviderErrorMessage", () => {
  it("includes provider label and error message detail", () => {
    const message = buildSignInProviderErrorMessage(
      "kakao",
      new Error("oauth launch timeout"),
    );
    expect(message).toContain("카카오");
    expect(message).toContain("oauth launch timeout");
  });

  it("includes attempt id when available", () => {
    const message = buildSignInProviderErrorMessage("google", {
      message: "oauth disabled",
      oauthAttemptId: "attempt-google-1",
    });
    expect(message).toContain("구글");
    expect(message).toContain("[시도 ID: attempt-google-1]");
  });
});
