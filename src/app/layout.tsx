// import type { Metadata } from "next";
import NavBar from "./components/NavBar";
import "../styles/globals.css";
import { Metadata } from "next";

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
  return (
    <html lang="en">
      <body>
        <div className="h-navbar fixed top-0 z-10 bg-neutral-50 w-full">
          <NavBar />
        </div>
        <div className="absolute top-20 w-full">{children}</div>
      </body>
    </html>
  );
}
