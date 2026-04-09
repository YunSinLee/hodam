export default function MyStoryDetailLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-orange-200" />
        <div className="absolute top-0 h-16 w-16 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
      <p className="mt-4 font-medium text-gray-600">동화를 불러오는 중...</p>
      <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
    </div>
  );
}
