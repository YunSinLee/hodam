import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  createSupabaseAdminClientMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  createSupabaseAdminClientMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

async function loadHandlers() {
  return import("./route");
}

function createAuthedContext() {
  authenticateRequestMock.mockResolvedValue({
    accessToken: "token-1",
    userId: "user-1",
    email: "user1@example.com",
  });
}

describe("/api/v1/profile/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
  });

  it("returns 401 when unauthorized on upload", async () => {
    const { POST } = await loadHandlers();
    authenticateRequestMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("uploads image and updates profile url", async () => {
    const { POST } = await loadHandlers();
    createAuthedContext();

    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/p.png" },
    });
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    const storageFromMock = vi.fn().mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
      remove: vi.fn(),
    });
    const fromMock = vi.fn().mockReturnValue({
      update: updateMock,
    });

    createSupabaseAdminClientMock.mockReturnValue({
      storage: { from: storageFromMock },
      from: fromMock,
    });

    const formData = new FormData();
    formData.append(
      "file",
      new File(["avatar-data"], "avatar.png", { type: "image/png" }),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
        body: formData,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.imageUrl).toBe("https://cdn.example.com/p.png");
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith({
      fallbackAccessToken: "token-1",
    });
    expect(storageFromMock).toHaveBeenCalledWith("profiles");
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("users");
    expect(updateEqMock).toHaveBeenCalledWith("id", "user-1");
  });

  it("returns 429 when upload rate limit is exceeded", async () => {
    const { POST } = await loadHandlers();
    createAuthedContext();
    checkRateLimitMock.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many profile image upload requests" });
  });

  it("returns 400 when non-image file is uploaded", async () => {
    const { POST } = await loadHandlers();
    createAuthedContext();

    const formData = new FormData();
    formData.append(
      "file",
      new File(["not-image"], "notes.txt", { type: "text/plain" }),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
        body: formData,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Only image files are allowed");
  });

  it("returns 401 when unauthorized on delete", async () => {
    const { DELETE } = await loadHandlers();
    authenticateRequestMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/v1/profile/image", {
        method: "DELETE",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("removes profile image reference and deletes object", async () => {
    const { DELETE } = await loadHandlers();
    createAuthedContext();

    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        custom_profile_url:
          "https://example.supabase.co/storage/v1/object/public/profiles/user-1/profile_123.png",
      },
      error: null,
    });
    const selectEqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      eq: selectEqMock,
    });
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    const storageFromMock = vi.fn().mockReturnValue({
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: removeMock,
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: selectMock,
          update: updateMock,
        };
      }

      return {
        select: vi.fn(),
        update: vi.fn(),
      };
    });

    createSupabaseAdminClientMock.mockReturnValue({
      storage: { from: storageFromMock },
      from: fromMock,
    });

    const response = await DELETE(
      new Request("http://localhost/api/v1/profile/image", {
        method: "DELETE",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateEqMock).toHaveBeenCalledWith("id", "user-1");
    expect(removeMock).toHaveBeenCalledWith(["user-1/profile_123.png"]);
  });

  it("returns 429 when delete rate limit is exceeded", async () => {
    const { DELETE } = await loadHandlers();
    createAuthedContext();
    checkRateLimitMock.mockReturnValue(false);

    const response = await DELETE(
      new Request("http://localhost/api/v1/profile/image", {
        method: "DELETE",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many profile image delete requests" });
  });
});
