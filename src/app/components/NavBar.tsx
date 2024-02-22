"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.scss";

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      <div className={styles["logo-and-title"]}>
        <img src="/Hodam1.png" className={styles.logo} />
        <span className={styles.title}>HODAM</span>
      </div>
      <div className={styles.links}>
        <Link href="/">
          <p className={pathname === "/" ? styles.active : ""}>Home</p>
        </Link>
        <Link href="/about">
          <p className={pathname === "/about" ? styles.active : ""}>About</p>
        </Link>
      </div>
    </nav>
  );
}
