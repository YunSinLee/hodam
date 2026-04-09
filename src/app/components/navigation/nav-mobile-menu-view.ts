export function getNavMobileMenuContainerClass(isOpen: boolean): string {
  return [
    "lg:hidden transition-all duration-300 ease-in-out",
    isOpen
      ? "max-h-[calc(100vh-4rem)] overflow-y-auto opacity-100"
      : "max-h-0 overflow-hidden opacity-0",
  ].join(" ");
}

export function getNavMobileItemClass(active: boolean): string {
  return [
    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
    active ? "bg-orange-100 text-orange-700" : "text-gray-600 hover:bg-gray-50",
  ].join(" ");
}

export function getNavUserInitial(email: string | undefined): string {
  const first = email?.trim().charAt(0);
  if (!first) return "U";
  return first.toUpperCase();
}
