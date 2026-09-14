import { describe, expect, it } from "vitest";

import { createApiRequestContext } from "@/lib/server/request-context";
import { REQUEST_ID_HEADER } from "@/lib/server/request-id";

describe("createApiRequestContext", () => {
  it("reuses incoming x-request-id and propagates to fail/ok responses", async () => {
    const context = createApiRequestContext({
      headers: new Headers({
        [REQUEST_ID_HEADER]: "req-existing-1",
      }),
    });

    expect(context.requestId).toBe("req-existing-1");

    const failResponse = context.fail(401, "Unauthorized");
    expect(failResponse.headers.get(REQUEST_ID_HEADER)).toBe("req-existing-1");
    await expect(failResponse.json()).resolves.toEqual({
      error: "Unauthorized",
    });

    const okResponse = context.ok({ ok: true });
    expect(okResponse.headers.get(REQUEST_ID_HEADER)).toBe("req-existing-1");
    await expect(okResponse.json()).resolves.toEqual({ ok: true });
  });

  it("generates x-request-id when missing", () => {
    const context = createApiRequestContext({
      headers: new Headers(),
    });

    expect(typeof context.requestId).toBe("string");
    expect(context.requestId.length).toBeGreaterThan(0);
  });
});
