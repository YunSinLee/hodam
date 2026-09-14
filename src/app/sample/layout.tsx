import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "그림책 미리보기",
  description:
    "로그인 없이 아이와 읽을 8쪽 그림책을 미리 만나보세요. 아이의 선택으로 이야기가 이어집니다.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
