import { describe, expect, it } from "vitest";

import { beginSignInRequest } from "@/app/sign-in/sign-in-request-guard";

describe("beginSignInRequest", () => {
  it("marks only the latest sign-in request as active", () => {
    const counter = { current: 0 };

    const isFirstRequestCurrent = beginSignInRequest(counter);
    const isSecondRequestCurrent = beginSignInRequest(counter);

    expect(isFirstRequestCurrent()).toBe(false);
    expect(isSecondRequestCurrent()).toBe(true);
  });

  it("keeps the request active while no newer request starts", () => {
    const counter = { current: 0 };

    const isCurrentRequest = beginSignInRequest(counter);

    expect(isCurrentRequest()).toBe(true);
    expect(isCurrentRequest()).toBe(true);
  });
});
