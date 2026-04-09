import { GoogleAnalytics } from "@next/third-parties/google";
import { Metadata } from "next";

import "../styles/globals.css";

import ChunkErrorRecovery from "./components/ChunkErrorRecovery";
import FooterWrapper from "./components/FooterWrapper";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  title: {
    template: "%s | 내가 만드는 동화, 호담",
    default: "호담 | 내가 만드는 동화, 호담",
  },
  description: "호랑이 담배피던 시절에. 내가 만드는 동화. 호담",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ChunkErrorRecovery />
        <div className="min-h-screen flex flex-col">
          <div className="h-navbar fixed top-0 z-10 w-full border-b-2 border-gray-300 bg-white">
            <NavBar />
          </div>
          <main className="flex-1 pt-20">{children}</main>
          <FooterWrapper />
        </div>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
