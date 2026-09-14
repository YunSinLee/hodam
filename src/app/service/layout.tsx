import type { Metadata } from "next";

export const maxDuration = 180;
export const metadata: Metadata = {
  title: "우리 아이 그림책 만들기",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
