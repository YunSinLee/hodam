interface MyStorySkeletonGridProps {
  count?: number;
}

export default function MyStorySkeletonGrid({
  count = 6,
}: MyStorySkeletonGridProps) {
  const skeletonKeys = Array.from(
    { length: count },
    (_, index) => `s-${index}`,
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {skeletonKeys.map((key, index) => (
        <div
          key={key}
          className="animate-pulse rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
          style={{
            animation: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
            animationDelay: `${index * 0.08}s`,
          }}
        >
          <div className="mb-4 h-4 w-3/4 rounded bg-gray-200" />
          <div className="mb-3 h-3 w-1/2 rounded bg-gray-200" />
          <div className="mb-3 h-3 w-full rounded bg-gray-200" />
          <div className="mt-5 flex justify-between">
            <div className="h-8 w-1/4 rounded bg-gray-200" />
            <div className="h-8 w-1/4 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
