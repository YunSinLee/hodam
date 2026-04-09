import { describe, expect, it } from "vitest";

import { resolveNavBarSessionState } from "@/app/components/navigation/nav-bar-controller-session";

import type { Session } from "@supabase/supabase-js";

function createSession(params: {
  id: string;
  email?: string;
  avatarUrl?: string;
}): Session {
  return {
    user: {
      id: params.id,
      email: params.email,
      user_metadata: {
        avatar_url: params.avatarUrl,
      },
    },
  } as Session;
}

describe("resolveNavBarSessionState", () => {
  it("returns reset state when session is null", () => {
    expect(resolveNavBarSessionState(null)).toEqual({
      userInfo: null,
      shouldResetBead: true,
    });
  });

  it("maps session user and keeps bead when session exists", () => {
    const result = resolveNavBarSessionState(
      createSession({
        id: "user-1",
        email: "user-1@example.com",
        avatarUrl: "https://example.com/avatar.png",
      }),
    );

    expect(result).toEqual({
      userInfo: {
        id: "user-1",
        email: "user-1@example.com",
        profileUrl: "https://example.com/avatar.png",
      },
      shouldResetBead: false,
    });
  });
});
