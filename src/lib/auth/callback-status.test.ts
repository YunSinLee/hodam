import { describe, expect, it } from "vitest";

import {
  getAuthCallbackStatusTitle,
  type AuthCallbackStatus,
} from "@/lib/auth/callback-status";

describe("getAuthCallbackStatusTitle", () => {
  it("maps loading status", () => {
    expect(getAuthCallbackStatusTitle("loading")).toBe("로그인 처리 중");
  });

  it("maps success status", () => {
    expect(getAuthCallbackStatusTitle("success")).toBe("로그인 성공!");
  });

  it("maps error status", () => {
    expect(getAuthCallbackStatusTitle("error")).toBe("로그인 실패");
  });

  it("stays exhaustive for known statuses", () => {
    const statuses: AuthCallbackStatus[] = ["loading", "success", "error"];
    const titles = statuses.map(status => getAuthCallbackStatusTitle(status));
    expect(new Set(titles).size).toBe(3);
  });
});
