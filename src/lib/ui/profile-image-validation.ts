const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImageLike {
  size: number;
  type: string;
}

export function validateProfileImageFile(file: ImageLike): string | null {
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    return "파일 크기는 5MB 이하여야 합니다.";
  }

  if (!file.type.startsWith("image/")) {
    return "이미지 파일만 업로드 가능합니다.";
  }

  return null;
}

export const profileImageValidationInternal = {
  MAX_PROFILE_IMAGE_BYTES,
};
