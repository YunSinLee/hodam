"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.scss";
import useUserInfo from "@/services/hooks/use-user-info";
import userApi from "@/app/api/user";
import { useEffect } from "react";
import { supabase } from "../utils/supabase";

export default function NavBar() {
  const { userInfo, setUserInfo } = useUserInfo();
  const pathname = usePathname();
  async function signOut() {
    await userApi.signOut();
    location.reload();
  }
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user! ?? null;
        console.log("user", user);
        if (user) {
          const userData = {
            profileUrl: "",
            id: user.id,
            email: user.email,
          };
          setUserInfo(userData);
          if (pathname === "/sign-in") {
            location.href = "/";
          }
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
