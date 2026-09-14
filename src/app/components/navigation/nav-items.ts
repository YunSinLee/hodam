export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const primaryNavItems: NavItem[] = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/service", label: "시작하기", icon: "✨" },
  { href: "/my-story", label: "내 동화", icon: "📚" },
];

export function isNavItemActive(
  pathname: string | null,
  itemHref: string,
): boolean {
  if (pathname === itemHref) {
    return true;
  }

  if (itemHref === "/my-story" && pathname?.includes("/my-story")) {
    return true;
  }

  return false;
}
