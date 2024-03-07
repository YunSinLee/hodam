"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.scss";
import useUserInfo from "@/services/hooks/use-user-info";
import userApi from "@/app/api/user";

export default function NavBar() {
  const { userInfo } = useUserInfo();
  const pathname = usePathname();
  async function signOut() {
    await userApi.signOut();
    location.reload();
  }
  return (
    <nav className={styles.nav}>
      <div className={styles["logo-and-title"]}>
        <img src="/Hodam1.png" className={styles.logo} />
        <span className={styles.title}>HODAM</span>
      </div>
      <div className={styles.links}>
        <Link href="/">
          <p className={pathname === "/" ? styles.active : ""}>홈</p>
        </Link>
        <Link href="/sign-up">
          <p className={pathname === "/sign-up" ? styles.active : ""}>
            회원가입
          </p>
        </Link>
        {userInfo.id ? (
          <button className={styles.active} onClick={signOut}>
            로그아웃
          </button>
        ) : (
          <Link href="/sign-in">
            <p className={pathname === "/sign-in" ? styles.active : ""}>
              로그인
            </p>
          </Link>
        )}
      </div>
    </nav>
  );
}
