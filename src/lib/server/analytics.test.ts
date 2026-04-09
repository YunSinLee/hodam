import { describe, expect, it, vi } from "vitest";

import {
  trackActivity,
  trackActivityBestEffort,
  trackUserActivity,
  trackUserActivityBestEffort,
} from "@/lib/server/analytics";

describe("server analytics", () => {
  it("tracks activity with request metadata", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({
      insert: insertMock,
    });
    const adminMock = {
      from: fromMock,
    } as never;

    await trackActivity(adminMock, {
      userId: "user-1",
      action: "auth_callback_success",
      details: {
        stage: "callback_success",
      },
      request: {
        headers: new Headers({
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "vitest",
        }),
      } as never,
    });

    expect(fromMock).toHaveBeenCalledWith("user_activity_logs");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        action: "auth_callback_success",
        details: {
          stage: "callback_success",
        },
        ip_address: "127.0.0.1",
        user_agent: "vitest",
      }),
    );
  });

  it("tracks anonymous activity without forcing user_id", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        insert: insertMock,
      }),
    } as never;

    await trackActivity(adminMock, {
      action: "auth_callback_error",
      details: {
        stage: "callback_error",
      },
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        user_id: expect.anything(),
      }),
    );
  });

  it("trackActivityBestEffort swallows insert errors", async () => {
    const adminMock = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: {
            message: "insert failed",
          },
        }),
      }),
    } as never;

    await expect(
      trackActivityBestEffort(adminMock, {
        action: "auth_callback_event",
      }),
    ).resolves.toBeUndefined();
  });

  it("trackUserActivity wrappers call activity tracker with user id", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        insert: insertMock,
      }),
    } as never;

    await trackUserActivity(adminMock, "user-2", "create_success", {
      threadId: 1,
    });
    await expect(
      trackUserActivityBestEffort(adminMock, "user-2", "continue_step"),
    ).resolves.toBeUndefined();

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-2",
      }),
    );
  });
});
