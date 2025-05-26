"use client";

import { usePathname } from "next/navigation";

import Footer from "./Footer";
import MiniFooter from "./MiniFooter";

export default function FooterWrapper() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return isHomePage ? <Footer /> : <MiniFooter />;
}
