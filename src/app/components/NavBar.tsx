"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import beadApi from "@/app/api/bead";
import userApi from "@/app/api/user";
import HButton from "@/app/components/atomic/HButton";
import { supabase } from "@/app/utils/supabase";
import useBead from "@/services/hooks/use-bead";
import useUserInfo, {
  defaultState as defaultUserInfoState,
} from "@/services/hooks/use-user-info";

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
    <nav className="flex items-center justify-between px-8 py-3">
      <Link href="/">
        <div className="flex items-center space-x-2">
          <img src="/hodam.png" className="w-12 h-12" />
          <span className="text-2xl font-semibold">HODAM</span>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        {bead && (
          <Link href="/bead">
            <div className="flex items-center">
              <div className="relative">
                <img src="/persimmon_240424.png" className="w-8 h-8 mr-1" />
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
                className={`text-lg font-medium ${pathname === "/" ? "text-orange-500" : ""}`}
              >
                홈
              </p>
            </Link>
            <Link href="/service">
              <p
                className={`text-lg font-medium ${pathname === "/service" ? "text-orange-500" : ""}`}
              >
                시작하기
              </p>
            </Link>
            <Link href="/my-story">
              <p
                className={`text-lg font-medium ${pathname?.includes("/my-story") ? "text-orange-500" : ""}`}
              >
                내 동화
              </p>
            </Link>
            {userInfo.id ? (
              <HButton
                className="py-0 font-medium text-lg"
                label="로그아웃"
                styleType="outlined"
                onClick={signOut}
              />
            ) : (
              <>
                {/* sign-up 링크 제거 */}
                <Link href="/sign-in">
                  <p
                    className={`text-lg font-medium ${pathname === "/sign-in" ? "text-orange-500" : ""}`}
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
              className={`font-medium text-lg ${pathname === "/" ? "text-orange-500" : ""}`}
            >
              홈
            </p>
          </Link>
          <Link href="/service">
            <p
              className={`font-medium text-lg ${pathname === "/service" ? "text-orange-500" : ""}`}
            >
              시작하기
            </p>
          </Link>
          <Link href="/my-story">
            <p
              className={`font-medium text-lg ${pathname?.includes("/my-story") ? "text-orange-500" : ""}`}
            >
              내 동화
            </p>
          </Link>
          {userInfo.id ? (
            <HButton
              className="py-0 font-medium text-lg"
              label="로그아웃"
              styleType="outlined"
              onClick={signOut}
            />
          ) : (
            <>
              {/* sign-up 링크 제거 */}
              <Link href="/sign-in">
                <p
                  className={`font-medium text-lg ${pathname === "/sign-in" ? "text-orange-500" : ""}`}
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
