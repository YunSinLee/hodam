"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  console.log(router, pathname);
  return (
    <nav>
      <Link href="/">
        <p style={{ color: pathname === "/" ? "red" : "blue" }}>Home</p>
      </Link>
      <Link href="/about">
        <p style={{ color: pathname === "/about" ? "red" : "blue" }}>About</p>
      </Link>
      <button type="button" onClick={() => router.push("/about")}>
        to About
      </button>
    </nav>
  );
}
