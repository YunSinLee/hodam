export default function ProfileLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600" />
        <p className="text-gray-600">프로필을 불러오는 중...</p>
      </div>
    </div>
  );
}
