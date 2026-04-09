import { getNavMobileMenuContainerClass } from "@/app/components/navigation/nav-mobile-menu-view";
import NavMobileAuthSection from "@/app/components/navigation/NavMobileAuthSection";
import NavMobilePrimaryLinks from "@/app/components/navigation/NavMobilePrimaryLinks";

interface NavMobileMenuProps {
  isOpen: boolean;
  pathname: string | null;
  hasHydrated: boolean;
  userId: string | undefined;
  userEmail: string | undefined;
  onCloseMenu: () => void;
  onSignOut: () => void;
}

export default function NavMobileMenu({
  isOpen,
  pathname,
  hasHydrated,
  userId,
  userEmail,
  onCloseMenu,
  onSignOut,
}: NavMobileMenuProps) {
  return (
    <div
      id="mobile-nav-menu"
      aria-hidden={!isOpen}
      className={getNavMobileMenuContainerClass(isOpen)}
    >
      <div className="bg-white/95 backdrop-blur-lg border-t border-orange-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
          <NavMobilePrimaryLinks
            pathname={pathname}
            onCloseMenu={onCloseMenu}
          />

          <div className="pt-4 border-t border-gray-100">
            <NavMobileAuthSection
              hasHydrated={hasHydrated}
              userId={userId}
              userEmail={userEmail}
              onCloseMenu={onCloseMenu}
              onSignOut={onSignOut}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
