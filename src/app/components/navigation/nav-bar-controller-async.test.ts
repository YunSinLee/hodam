import { describe, expect, it, vi } from "vitest";

import {
  readNavBarSession,
  resolveNavBarBeadValue,
} from "@/app/components/navigation/nav-bar-controller-async";

import type { Session } from "@supabase/supabase-js";

function createSession(userId: string): Session {
  return {
    user: {
      id: userId,
      email: `${userId}@example.com`,
      user_metadata: {},
    },
  } as Session;
}

describe("readNavBarSession", () => {
  it("returns session when reader succeeds", async () => {
    const session = createSession("user-1");
    await expect(
      readNavBarSession(async () => ({
        data: { session },
      })),
    ).resolves.toBe(session);
  });

  it("returns null when reader returns empty session", async () => {
    await expect(
      readNavBarSession(async () => ({
        data: { session: null },
      })),
    ).resolves.toBeNull();
  });

  it("returns null when reader throws", async () => {
    await expect(
      readNavBarSession(async () => {
        throw new Error("session read failed");
      }),
    ).resolves.toBeNull();
  });
});

describe("resolveNavBarBeadValue", () => {
  const fallbackBead = {
    id: undefined,
    count: undefined,
    created: undefined,
    user_id: undefined,
  };

  it("returns fallback bead when user id is missing", async () => {
    const loader = vi.fn().mockResolvedValue({
      id: "bead-1",
      count: 3,
      created: undefined,
      user_id: "user-1",
    });

    const bead = await resolveNavBarBeadValue({
      userId: undefined,
      loadBead: loader,
      fallbackBead,
    });

    expect(bead).toBe(fallbackBead);
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns loaded bead when user id is present and loader succeeds", async () => {
    const loadedBead = {
      id: "bead-1",
      count: 5,
      created: undefined,
      user_id: "user-1",
    };

    const bead = await resolveNavBarBeadValue({
      userId: "user-1",
      loadBead: async () => loadedBead,
      fallbackBead,
    });

    expect(bead).toEqual(loadedBead);
  });

  it("returns fallback bead when loader throws", async () => {
    const bead = await resolveNavBarBeadValue({
      userId: "user-1",
      loadBead: async () => {
        throw new Error("load failed");
      },
      fallbackBead,
    });

    expect(bead).toBe(fallbackBead);
  });
});
