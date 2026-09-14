import { GoogleAnalytics } from "@next/third-parties/google";
import { Metadata } from "next";
import { PrimeReactProvider } from "primereact/api";

import { createSiteVerification, SITE_URL } from "@/lib/seo";

import "primeicons/primeicons.css";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-amber/theme.css";
import "../styles/globals.css";

import ChunkErrorRecovery from "./components/ChunkErrorRecovery";
import FooterWrapper from "./components/FooterWrapper";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "호담",
  title: {
    template: "%s | 호담",
    default: "호담 | 오늘을 담은 잠자리 그림책",
  },
  description:
    "짧은 잠자리 동화를 함께 읽고, 아이의 하루를 담은 AI 그림 동화를 만들어보세요. 이야기를 고르면 8쪽 그림책이 완성돼요.",
  verification: createSiteVerification(),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID!;

  return (
    <html lang="ko">
      <body>
        <ChunkErrorRecovery />
        <PrimeReactProvider value={{ ripple: true }}>
          <div className="min-h-screen flex flex-col">
            <a className="skip-link" href="#main-content">
              본문으로 바로가기
            </a>
            <NavBar />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
            <FooterWrapper />
          </div>
        </PrimeReactProvider>
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
