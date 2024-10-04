import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/themes/lara-light-amber/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import NavBar from "./components/NavBar";
import "../styles/globals.css";
import { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
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
  const gaId = process.env.NEXT_PUBLIC_GA_ID!;

  return (
    <html lang="en">
      <PrimeReactProvider value={{ ripple: true }}>
        <body>
          <div className="h-navbar fixed top-0 z-10 w-full">
            <NavBar />
          </div>
          <div className="absolute top-20 w-full">{children}</div>
        </body>
      </PrimeReactProvider>
      <GoogleAnalytics gaId={gaId} />
    </html>
  );
}
