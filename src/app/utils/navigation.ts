export function safeReturnPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.split("").some(char => char.charCodeAt(0) <= 32)
  )
    return "/service";
  try {
    const url = new URL(value, "https://hodam.local");
    if (
      url.origin !== "https://hodam.local" ||
      url.pathname.startsWith("/auth") ||
      url.pathname === "/sign-in"
    )
      return "/service";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/service";
  }
}
