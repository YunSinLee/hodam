import { createPublicMetadata } from "@/lib/seo";

export const metadata = createPublicMetadata({
  title: "그림책 미리보기",
  description:
    "로그인 없이 아이와 읽을 8쪽 그림책을 미리 만나보세요. 아이의 선택으로 이야기가 이어집니다.",
  path: "/sample",
});
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
