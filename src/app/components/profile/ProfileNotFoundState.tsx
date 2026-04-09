interface ProfileNotFoundStateProps {
  onGoHome: () => void;
}

export default function ProfileNotFoundState({
  onGoHome,
}: ProfileNotFoundStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="text-center">
        <p className="mb-4 text-gray-600">프로필을 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={onGoHome}
          className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
