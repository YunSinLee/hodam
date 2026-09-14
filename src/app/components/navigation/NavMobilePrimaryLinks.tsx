import Link from "next/link";

import {
  isNavItemActive,
  primaryNavItems,
} from "@/app/components/navigation/nav-items";
import { getNavMobileItemClass } from "@/app/components/navigation/nav-mobile-menu-view";

interface NavMobilePrimaryLinksProps {
  pathname: string | null;
  onCloseMenu: () => void;
}

export default function NavMobilePrimaryLinks({
  pathname,
  onCloseMenu,
}: NavMobilePrimaryLinksProps) {
  return (
    <>
      {primaryNavItems.map(item => {
        const active = isNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onCloseMenu}
            className="block"
          >
            <div className={getNavMobileItemClass(active)}>
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </>
  );
}
