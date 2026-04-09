export default function MyStoryHeader() {
  return (
    <header className="mb-6 border-b pb-4 sm:mb-8">
      <h1 className="relative mb-2 text-2xl font-bold text-orange-600 sm:text-3xl">
        내 동화
        <span className="absolute bottom-0 left-0 h-1 w-24 translate-y-2 rounded-full bg-orange-400 sm:w-1/3" />
      </h1>
      <p className="text-sm text-gray-600 sm:text-base">
        내가 만든 동화 목록을 확인해보세요
      </p>
    </header>
  );
}
