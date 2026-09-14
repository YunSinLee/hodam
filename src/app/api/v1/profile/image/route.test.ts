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
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 401 when authenticateRequest throws on upload", async () => {
    const { POST } = await loadHandlers();
    authenticateRequestMock.mockRejectedValue(new Error("auth transport down"));

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("uploads image and updates profile url", async () => {
    const { POST } = await loadHandlers();
    createAuthedContext();

    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://cdn.example.com/signed/p.png" },
      error: null,
    });
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    const storageFromMock = vi.fn().mockReturnValue({
      upload: uploadMock,
      createSignedUrl: createSignedUrlMock,
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
      new File(["avatar-data"], "avatar.svg", { type: "image/png" }),
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
    expect(body.imageUrl).toBe("https://cdn.example.com/signed/p.png");
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith({
      fallbackAccessToken: "token-1",
    });
    expect(storageFromMock).toHaveBeenCalledWith("profiles");
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const path = uploadMock.mock.calls[0][0];
    expect(path).toMatch(/^profile_user-1_[0-9a-f-]+\.png$/);
    expect(uploadMock.mock.calls[0][2]).toMatchObject({ upsert: false });
    expect(createSignedUrlMock).toHaveBeenCalledWith(path, 3600);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_profile_url: `profiles:${path}`,
      }),
    );
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
    expect(body).toEqual({
      error: "Too many profile image upload requests",
      code: "PROFILE_IMAGE_UPLOAD_RATE_LIMITED",
    });
  });

  it.each(["text/plain", "image/svg+xml"])(
    "returns 400 for unsupported content type %s",
    async contentType => {
      const { POST } = await loadHandlers();
      createAuthedContext();

      const formData = new FormData();
      formData.append(
        "file",
        new File(["not-image"], "notes.txt", { type: contentType }),
      );

      const response = await POST(
        new Request("http://localhost/api/v1/profile/image", {
          method: "POST",
          body: formData,
        }) as never,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        error: "Only image files are allowed",
        code: "PROFILE_IMAGE_CONTENT_TYPE_INVALID",
      });
    },
  );

  it("returns 400 when image file is missing", async () => {
    const { POST } = await loadHandlers();
    createAuthedContext();

    const formData = new FormData();

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
        body: formData,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Image file is required",
      code: "PROFILE_IMAGE_REQUIRED",
    });
  });

  it("returns 400 when image file exceeds 5MB", async () => {
    const { POST } = await loadHandlers();
    createAuthedContext();

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/profile/image", {
        method: "POST",
        body: formData,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Image file must be 5MB or smaller",
      code: "PROFILE_IMAGE_SIZE_EXCEEDED",
    });
  });

  it.each(["upload", "signing"])(
    "does not save an unreadable profile after %s fails",
    async failureStage => {
      const { POST } = await loadHandlers();
      createAuthedContext();

      const storageFromMock = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          error:
            failureStage === "upload" ? { message: "upload failed" } : null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "signing failed" },
        }),
        remove: vi.fn(),
      });
      const fromMock = vi.fn().mockReturnValue({
        update: vi.fn(),
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

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: "Failed to upload profile image",
        code: "PROFILE_IMAGE_UPLOAD_FAILED",
      });
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

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
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it.each([
    [
      "https://example.supabase.co/storage/v1/object/public/profiles/user-1/profile_123.png",
      "user-1/profile_123.png",
    ],
    ["profiles:profile_user-1_abcd-1234.png", "profile_user-1_abcd-1234.png"],
    ["profiles:profile_user-2_abcd-1234.png", null],
    [
      "https://example.supabase.co/storage/v1/object/public/profiles/user-2/profile_123.png",
      null,
    ],
    ["profiles:profile_user-1_../../user-2/profile_123.png", null],
  ])(
    "removes the reference and deletes only an owned object: %s",
    async (reference, expectedPath) => {
      const { DELETE } = await loadHandlers();
      createAuthedContext();

      const removeMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          custom_profile_url: reference,
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
      if (expectedPath) {
        expect(removeMock).toHaveBeenCalledWith([expectedPath]);
      } else {
        expect(removeMock).not.toHaveBeenCalled();
      }
    },
  );

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
    expect(body).toEqual({
      error: "Too many profile image delete requests",
      code: "PROFILE_IMAGE_DELETE_RATE_LIMITED",
    });
  });

  it("returns 500 when profile image delete flow fails", async () => {
    const { DELETE } = await loadHandlers();
    createAuthedContext();

    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db read failed" },
    });
    const selectEqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      eq: selectEqMock,
    });
    const updateMock = vi.fn();

    const fromMock = vi.fn().mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    createSupabaseAdminClientMock.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ remove: vi.fn() }) },
      from: fromMock,
    });

    const response = await DELETE(
      new Request("http://localhost/api/v1/profile/image", {
        method: "DELETE",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to remove profile image",
      code: "PROFILE_IMAGE_DELETE_FAILED",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
