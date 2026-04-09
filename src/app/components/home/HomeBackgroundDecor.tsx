export default function HomeBackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute left-1/4 top-1/4 h-64 w-64 animate-pulse rounded-full bg-orange-200 opacity-20 mix-blend-multiply blur-xl filter" />
      <div
        className="absolute right-1/4 top-3/4 h-64 w-64 animate-pulse rounded-full bg-amber-200 opacity-20 mix-blend-multiply blur-xl filter"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-64 w-64 animate-pulse rounded-full bg-orange-300 opacity-10 mix-blend-multiply blur-xl filter"
        style={{ animationDelay: "4s" }}
      />
    </div>
  );
}
