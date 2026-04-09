"use client";

import NavAuthActions from "@/app/components/navigation/NavAuthActions";
import NavBeadBadge from "@/app/components/navigation/NavBeadBadge";
import NavBrand from "@/app/components/navigation/NavBrand";
import NavDesktopLinks from "@/app/components/navigation/NavDesktopLinks";
import NavMenuToggleButton from "@/app/components/navigation/NavMenuToggleButton";
import NavMobileMenu from "@/app/components/navigation/NavMobileMenu";
import useNavBarController from "@/app/components/navigation/useNavBarController";

export default function NavBar() {
  const { state, handlers } = useNavBarController();

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          state.isScrolled
            ? "bg-white/80 backdrop-blur-lg shadow-lg border-b border-orange-100/50"
            : "bg-white/60 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <NavBrand />

            <NavDesktopLinks pathname={state.pathname} />

            <div className="flex items-center gap-3">
              <NavBeadBadge count={state.beadCount} />

              <NavAuthActions
                hasHydrated={state.hasHydrated}
                userId={state.userId}
                userEmail={state.userEmail}
                onSignOut={handlers.onSignOut}
              />

              <NavMenuToggleButton
                isOpen={state.isShowMenu}
                onToggle={handlers.onToggleMenu}
              />
            </div>
          </div>
        </div>

        <NavMobileMenu
          isOpen={state.isShowMenu}
          pathname={state.pathname}
          hasHydrated={state.hasHydrated}
          userId={state.userId}
          userEmail={state.userEmail}
          onCloseMenu={handlers.onCloseMenu}
          onSignOut={handlers.onSignOut}
        />
      </nav>

      <div className="h-16 sm:h-20" />
    </>
  );
}
