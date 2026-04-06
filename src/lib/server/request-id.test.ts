import { describe, expect, it } from "vitest";

import {
  requestIdInternal,
  REQUEST_ID_HEADER,
  resolveRequestId,
  withRequestIdHeaders,
} from "@/lib/server/request-id";

describe("resolveRequestId", () => {
  it("uses incoming request id when valid", () => {
    const headers = new Headers({
      [REQUEST_ID_HEADER]: "req-abc_123",
    });

    expect(resolveRequestId(headers)).toBe("req-abc_123");
  });

  it("generates request id when header is missing", () => {
    const headers = new Headers();
    const requestId = resolveRequestId(headers);

    expect(typeof requestId).toBe("string");
    expect(requestId.length).toBeGreaterThan(0);
  });

  it("ignores malformed incoming request id", () => {
    const headers = new Headers({
      [REQUEST_ID_HEADER]: "invalid with space",
    });

    const requestId = resolveRequestId(headers);

    expect(requestId).not.toBe("invalid with space");
    expect(requestIdInternal.REQUEST_ID_PATTERN.test(requestId)).toBe(true);
  });
});

describe("withRequestIdHeaders", () => {
  it("sets x-request-id while preserving existing headers", () => {
    const headers = withRequestIdHeaders(
      {
        "x-custom": "1",
      },
      "req-xyz",
    );

    expect(headers.get("x-custom")).toBe("1");
    expect(headers.get(REQUEST_ID_HEADER)).toBe("req-xyz");
  });

  it("does not set malformed request id values", () => {
    const headers = withRequestIdHeaders(undefined, "bad value");
    expect(headers.get(REQUEST_ID_HEADER)).toBeNull();
  });

  it("accepts max length request id", () => {
    const id = "a".repeat(requestIdInternal.MAX_REQUEST_ID_LENGTH);
    const headers = withRequestIdHeaders(undefined, id);
    expect(headers.get(REQUEST_ID_HEADER)).toBe(id);
  });
});
