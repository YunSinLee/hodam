import { describe, expect, it } from "vitest";

import {
  profileImageValidationInternal,
  validateProfileImageFile,
} from "@/lib/ui/profile-image-validation";

describe("validateProfileImageFile", () => {
  it("rejects oversized file", () => {
    const error = validateProfileImageFile({
      size: profileImageValidationInternal.MAX_PROFILE_IMAGE_BYTES + 1,
      type: "image/png",
    });

    expect(error).toBe("파일 크기는 5MB 이하여야 합니다.");
  });

  it("rejects non-image mime type", () => {
    const error = validateProfileImageFile({
      size: 1024,
      type: "application/pdf",
    });

    expect(error).toBe("이미지 파일만 업로드 가능합니다.");
  });

  it("returns null for valid image file", () => {
    const error = validateProfileImageFile({
      size: 1024,
      type: "image/jpeg",
    });

    expect(error).toBeNull();
  });
});
