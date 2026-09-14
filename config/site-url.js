const DEFAULT_SITE_URL = "https://hodam.vercel.app";

/**
 * Canonicals and sitemaps must agree on a public production origin. Local OAuth
 * settings and Vercel preview URLs are deliberately not publishing destinations.
 * @param {string | undefined} value
 */
function resolveSiteUrl(value) {
  if (!value) return DEFAULT_SITE_URL;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isLocal =
      !hostname.includes(".") ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^\d+(?:\.\d+){3}$/.test(hostname) ||
      hostname.includes(":");
    const isPreview =
      hostname.endsWith(".vercel.app") && hostname !== "hodam.vercel.app";

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      isLocal ||
      isPreview
    ) {
      return DEFAULT_SITE_URL;
    }

    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

module.exports = { DEFAULT_SITE_URL, resolveSiteUrl };
