import type { ChangeEvent } from "react";

interface ProfileImageOptionsModalProps {
  isUploadingImage: boolean;
  hasCustomProfileImage: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function ProfileImageOptionsModal({
  isUploadingImage,
  hasCustomProfileImage,
  onUpload,
  onRemove,
  onClose,
}: ProfileImageOptionsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6">
        <h3 className="mb-4 text-center text-lg font-bold text-gray-800">
          프로필 이미지 설정
        </h3>

        <div className="space-y-3">
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden"
              disabled={isUploadingImage}
            />
            <div className="w-full cursor-pointer rounded-lg bg-orange-600 px-4 py-3 text-center text-white transition-colors hover:bg-orange-700 disabled:bg-gray-400">
              {isUploadingImage ? "업로드 중..." : "새 이미지 업로드"}
            </div>
          </label>

          {hasCustomProfileImage && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isUploadingImage}
              className="w-full rounded-lg bg-gray-500 px-4 py-3 text-white transition-colors hover:bg-gray-600 disabled:bg-gray-400"
            >
              {isUploadingImage ? "삭제 중..." : "기본 이미지로 되돌리기"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={isUploadingImage}
            className="w-full rounded-lg bg-gray-200 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-300 disabled:bg-gray-400"
          >
            취소
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          • 최대 5MB까지 업로드 가능
          <br />• JPG, PNG, GIF 형식 지원
        </p>
      </div>
    </div>
  );
}
