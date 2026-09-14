import { describe, expect, it } from "vitest";

import { fail, ok } from "@/lib/server/api-response";
import { REQUEST_ID_HEADER } from "@/lib/server/request-id";

describe("api-response", () => {
  it("ok includes request id header when provided", async () => {
    const response = ok(
      { success: true },
      {
        requestId: "req-ok-1",
        headers: {
          "x-custom": "yes",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-ok-1");
    expect(response.headers.get("x-custom")).toBe("yes");
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("fail includes status, body, and request id header", async () => {
    const response = fail(
      400,
      "invalid_input",
      {
        field: "keywords",
      },
      { requestId: "req-fail-1" },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-fail-1");
    await expect(response.json()).resolves.toEqual({
      error: "invalid_input",
      field: "keywords",
    });
  });

  it("fail leaves request id header empty when missing", () => {
    const response = fail(500, "internal_error");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeNull();
  });
});
