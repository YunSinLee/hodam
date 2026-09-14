import { GoogleAnalytics } from "@next/third-parties/google";
import { Metadata } from "next";
import { PrimeReactProvider } from "primereact/api";

import "primeicons/primeicons.css";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-amber/theme.css";
import "../styles/globals.css";

import FooterWrapper from "./components/FooterWrapper";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  title: {
    template: "%s | 호담",
    default: "호담 | 오늘을 담은 잠자리 그림책",
  },
  description:
    "아이의 하루를 8쪽 잠자리 그림책으로. 함께 이야기를 고르고, 오늘 밤 나란히 읽어요.",
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
