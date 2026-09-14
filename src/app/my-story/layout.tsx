import type { Metadata } from "next";

export const maxDuration = 60;
export const metadata: Metadata = {
  title: "내 책장",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
