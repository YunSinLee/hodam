import Link from "next/link";

import {
  isNavItemActive,
  primaryNavItems,
} from "@/app/components/navigation/nav-items";

interface NavDesktopLinksProps {
  pathname: string | null;
}

export default function NavDesktopLinks({ pathname }: NavDesktopLinksProps) {
  return (
    <div className="hidden lg:flex items-center space-x-1">
      {primaryNavItems.map(item => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className="group">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                active
                  ? "bg-orange-100 text-orange-700 shadow-sm"
                  : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
