"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useUserInfo, {
  defaultState as defaultUserInfoState,
} from "@/services/hooks/use-user-info";
import useBead from "@/services/hooks/use-bead";
import userApi from "@/app/api/user";
import beadApi from "@/app/api/bead";
import { useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import HButton from "@/app/components/atomic/HButton";

export default function NavBar() {
  const { userInfo, setUserInfo } = useUserInfo();
  const { bead, setBead } = useBead();
  const [isShowMenu, setIsShowMenu] = useState(false);
  const pathname = usePathname();
  async function signOut() {
    await userApi.signOut();
    location.reload();
  }
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          setUserInfo(defaultUserInfoState);
        }
        if (session) {
          const user = session?.user! ?? null;
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

  useEffect(() => {
    const fetchBead = async () => {
      if (userInfo.id) {
        const beadInfo = await beadApi.initializeBead(userInfo.id);

        setBead(beadInfo);
      }
    };

    fetchBead();
  }, [userInfo.id]);

  return (
    <nav className="flex items-center justify-between px-8 py-3 border-b-2 border-gray-300">
      <div className="flex items-center space-x-2">
        <img src="/Hodam1.png" className="w-12 h-14" />
        <span className="text-2xl font-semibold">HODAM</span>
      </div>
      <div className="flex items-center gap-4">
        {bead && (
          <Link href="/bead">
            <div className="flex items-center">
              <div className="relative">
                <img src="/bead.png" className="w-8 h-8 mr-1" />
                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-orange-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-semibold">
                  {bead.count}
                </div>
              </div>
            </div>
          </Link>
        )}
        <div
          className="block sm:hidden text-2xl"
          onClick={() => setIsShowMenu(!isShowMenu)}
        >
          ☰
        </div>
        {isShowMenu ? (
          <div
            className="absolute p-4 shadow-md right-2 border-2 rounded-md top-16 bg-white flex flex-col items-center gap-4 sm:hidden"
            onClick={() => setIsShowMenu(!isShowMenu)}
          >
            <Link href="/">
              <p
                className={`text-lg font-normal ${pathname === "/" ? "text-orange-500" : ""}`}
              >
                홈
              </p>
            </Link>
            <Link href="/service">
              <p
                className={`text-lg font-normal ${pathname === "/service" ? "text-orange-500" : ""}`}
              >
                시작하기
              </p>
            </Link>
            <Link href="/my-story">
              <p
                className={`text-lg font-normal ${pathname.includes("/my-story") ? "text-orange-500" : ""}`}
              >
                내 동화
              </p>
            </Link>
            {userInfo.id ? (
              <HButton
                className="py-0"
                label="로그아웃"
                style="outlined"
                onClick={signOut}
              />
            ) : (
              <>
                <Link href="/sign-up">
                  <p
                    className={`text-lg font-normal ${pathname === "/sign-up" ? "text-orange-500" : ""}`}
                  >
                    회원가입
                  </p>
                </Link>
                <Link href="/sign-in">
                  <p
                    className={`text-lg font-normal ${pathname === "/sign-in" ? "text-orange-500" : ""}`}
                  >
                    로그인
                  </p>
                </Link>
              </>
            )}
          </div>
        ) : null}

        <div className="hidden sm:flex sm:items-center sm:gap-4">
          <Link href="/">
            <p
              className={`text-lg font-normal ${pathname === "/" ? "text-orange-500" : ""}`}
            >
              홈
            </p>
          </Link>
          <Link href="/service">
            <p
              className={`text-lg font-normal ${pathname === "/service" ? "text-orange-500" : ""}`}
            >
              시작하기
            </p>
          </Link>
          <Link href="/my-story">
            <p
              className={`text-lg font-normal ${pathname.includes("/my-story") ? "text-orange-500" : ""}`}
            >
              내 동화
            </p>
          </Link>
          {userInfo.id ? (
            <HButton
              className="py-0"
              label="로그아웃"
              style="outlined"
              onClick={signOut}
            />
          ) : (
            <>
              <Link href="/sign-up">
                <p
                  className={`text-lg font-normal ${pathname === "/sign-up" ? "text-orange-500" : ""}`}
                >
                  회원가입
                </p>
              </Link>
              <Link href="/sign-in">
                <p
                  className={`text-lg font-normal ${pathname === "/sign-in" ? "text-orange-500" : ""}`}
                >
                  로그인
                </p>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
