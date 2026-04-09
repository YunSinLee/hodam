interface ProfileConfirmModalProps {
  action: "logout" | "removeImage";
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ProfileConfirmModal({
  action,
  onCancel,
  onConfirm,
}: ProfileConfirmModalProps) {
  const title = action === "logout" ? "로그아웃 확인" : "이미지 삭제 확인";
  const description =
    action === "logout"
      ? "정말 로그아웃하시겠습니까?"
      : "커스텀 프로필 이미지를 삭제하고 소셜 로그인 이미지로 되돌릴까요?";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-3 text-lg font-bold text-gray-800">{title}</h3>
        <p className="mb-5 text-sm text-gray-600">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
