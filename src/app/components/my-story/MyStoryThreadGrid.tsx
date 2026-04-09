import type { ThreadWithUser } from "@/app/types/openai";

import MyStoryCard from "./MyStoryCard";

interface MyStoryThreadGridProps {
  threads: ThreadWithUser[];
}

export default function MyStoryThreadGrid({ threads }: MyStoryThreadGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {threads.map((thread, index) => (
        <MyStoryCard key={thread.id} thread={thread} index={index} />
      ))}
    </div>
  );
}
