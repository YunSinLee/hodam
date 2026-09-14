import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import { resolveProfileImageErrorMessage } from "@/lib/ui/profile-image-error";

describe("resolveProfileImageErrorMessage", () => {
  it("returns auth message for 401", () => {
    expect(
      resolveProfileImageErrorMessage(
        new ApiError(401, "Unauthorized"),
        "fallback",
      ),
    ).toBe("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
  });

  it("returns mapped message for known api error codes", () => {
    expect(
      resolveProfileImageErrorMessage(
        new ApiError(400, "Only image files are allowed", {
          code: "PROFILE_IMAGE_CONTENT_TYPE_INVALID",
        }),
        "fallback",
      ),
    ).toBe("이미지 파일만 업로드 가능합니다.");
  });

  it("returns mapped message for known 5xx api error codes", () => {
    expect(
      resolveProfileImageErrorMessage(
        new ApiError(500, "Failed to upload profile image", {
          code: "PROFILE_IMAGE_UPLOAD_FAILED",
        }),
        "업로드 실패",
      ),
    ).toBe("이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
  });

  it("returns original api error message when code is unknown", () => {
    expect(
      resolveProfileImageErrorMessage(
        new ApiError(400, "Custom validation failure", {
          code: "UNKNOWN_CODE",
        }),
        "fallback",
      ),
    ).toBe("Custom validation failure");
  });

  it("returns regular Error message", () => {
    expect(resolveProfileImageErrorMessage(new Error("boom"), "fallback")).toBe(
      "boom",
    );
  });

  it("returns fallback for unknown values", () => {
    expect(resolveProfileImageErrorMessage("unexpected", "fallback")).toBe(
      "fallback",
    );
  });
});
