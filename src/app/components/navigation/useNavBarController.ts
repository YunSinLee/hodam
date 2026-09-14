"use client";

import { useCallback, useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import {
  readNavBarSession,
  resolveNavBarBeadValue,
} from "@/app/components/navigation/nav-bar-controller-async";
import type {
  NavBarControllerHandlers,
  NavBarControllerState,
} from "@/app/components/navigation/nav-bar-controller-contract";
import { resolveNavBarSessionState } from "@/app/components/navigation/nav-bar-controller-session";
import {
  resolveNavBarAuthRedirect,
  resolveNavBarScrollState,
} from "@/app/components/navigation/nav-bar-controller-utils";
import { supabase } from "@/app/utils/supabase";
import beadApi from "@/lib/client/api/bead";
import userApi from "@/lib/client/api/user";
import useBead, {
  defaultState as defaultBeadState,
} from "@/services/hooks/use-bead";
import useUserInfo, {
  defaultState as defaultUserInfoState,
} from "@/services/hooks/use-user-info";

import type { Session } from "@supabase/supabase-js";

export default function useNavBarController(): {
  state: NavBarControllerState;
  handlers: NavBarControllerHandlers;
} {
  const { userInfo, setUserInfo, hasHydrated } = useUserInfo();
  const { bead, setBead } = useBead();
  const [isShowMenu, setIsShowMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const applySession = useCallback(
    (session: Session | null) => {
      const resolvedSession = resolveNavBarSessionState(session);
      if (!resolvedSession.userInfo) {
        setUserInfo(defaultUserInfoState);
        if (resolvedSession.shouldResetBead) {
          setBead(defaultBeadState);
        }
        return;
      }

      setUserInfo(resolvedSession.userInfo);
    },
    [setUserInfo, setBead],
  );

  const onSignOut = useCallback(async () => {
    try {
      await userApi.signOut();
    } catch {
      // Ignore local sign-out error and continue clearing local state.
    }
    applySession(null);
    setIsShowMenu(false);
    router.replace("/");
    router.refresh();
  }, [applySession, router]);

  const onToggleMenu = useCallback(() => {
    setIsShowMenu(prev => !prev);
  }, []);

  const onCloseMenu = useCallback(() => {
    setIsShowMenu(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(resolveNavBarScrollState(window.scrollY));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const session = await readNavBarSession(() => supabase.auth.getSession());
      if (!mounted) return;
      applySession(session);
    };

    initializeAuth();
    return () => {
      mounted = false;
    };
  }, [applySession]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        applySession(session || null);

        if (
          resolveNavBarAuthRedirect({
            event,
            hasSessionUser: Boolean(session?.user),
            pathname,
          })
        ) {
          router.replace("/");
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [applySession, pathname, router]);

  useEffect(() => {
    const fetchBead = async () => {
      const beadValue = await resolveNavBarBeadValue({
        userId: userInfo.id,
        loadBead: () => beadApi.initializeBead(),
        fallbackBead: defaultBeadState,
      });
      setBead(beadValue);
    };

    fetchBead();
  }, [userInfo.id, setBead]);

  const state: NavBarControllerState = {
    pathname,
    hasHydrated,
    userId: userInfo.id,
    userEmail: userInfo.email,
    beadCount: bead?.count,
    isShowMenu,
    isScrolled,
  };

  const handlers: NavBarControllerHandlers = {
    onSignOut,
    onToggleMenu,
    onCloseMenu,
  };

  return {
    state,
    handlers,
  };
}
