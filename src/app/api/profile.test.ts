import { beforeEach, describe, expect, it, vi } from "vitest";

import profileApi from "@/lib/client/api/profile";

const { authorizedFetchMock } = vi.hoisted(() => ({
  authorizedFetchMock: vi.fn(),
}));

vi.mock("@/lib/client/api/http", () => ({
  ApiError: class MockApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  authorizedFetch: authorizedFetchMock,
}));

describe("profileApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads profile summary through /api/v1/profile/summary", async () => {
    authorizedFetchMock.mockResolvedValue({
      profile: { id: "u1" },
      stats: {},
      recentStories: [],
    });

    await profileApi.getProfileSummary(7);

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/profile/summary?limit=7",
      { method: "GET" },
      expect.anything(),
    );
  });

  it("updates display name through v1 endpoint", async () => {
    authorizedFetchMock.mockResolvedValue({ success: true });

    const result = await profileApi.updateDisplayName("user-1", "호담이");

    expect(result).toBe(true);
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/profile/display-name",
      {
        method: "POST",
        body: JSON.stringify({ displayName: "호담이" }),
      },
      expect.anything(),
    );
  });

  it("skips display name update when userId is empty", async () => {
    const result = await profileApi.updateDisplayName("", "호담이");

    expect(result).toBe(false);
    expect(authorizedFetchMock).not.toHaveBeenCalled();
  });

  it("uploads profile image through v1 endpoint", async () => {
    authorizedFetchMock.mockResolvedValue({
      success: true,
      imageUrl: "https://example.com/image.png",
    });

    const imageFile = new File(["test"], "profile.png", { type: "image/png" });
    const imageUrl = await profileApi.uploadProfileImage("user-1", imageFile);

    expect(imageUrl).toBe("https://example.com/image.png");
    const [path, init] = authorizedFetchMock.mock.calls[0];
    expect(path).toBe("/api/v1/profile/image");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("removes custom profile image through v1 endpoint", async () => {
    authorizedFetchMock.mockResolvedValue({ success: true });

    const result = await profileApi.removeCustomProfileImage("user-1");

    expect(result).toBe(true);
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/profile/image",
      {
        method: "DELETE",
      },
      expect.anything(),
    );
  });
});
