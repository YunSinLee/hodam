import { resolveSiteUrl } from "../../config/site-url";

import type { Metadata } from "next";

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_NAME = "호담";
export const DEFAULT_SHARE_IMAGE = "/hodam_with_text.png";

type PublicMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

/** Accept only paths so callers cannot accidentally publish preview canonicals. */
function publicUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Public metadata requires a root-relative path.");
  }

  const url = new URL(path, SITE_URL);
  if (url.origin !== SITE_URL) {
    throw new Error("Public metadata URL must stay on the production origin.");
  }
  url.search = "";
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function createPublicMetadata({
  title,
  description,
  path,
  image = DEFAULT_SHARE_IMAGE,
}: PublicMetadataOptions): Metadata {
  const url = publicUrl(path);
  const imageUrl = publicUrl(image);
  const shareTitle = `${title} | ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: SITE_NAME,
      title: shareTitle,
      description,
      url,
      images: [{ url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [imageUrl],
    },
    robots: { index: true, follow: true },
  };
}

/** Tokens remain optional until a property owner supplies the real values. */
export function createSiteVerification(): Metadata["verification"] {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const naver = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION?.trim();
  if (!google && !naver) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(naver ? { other: { "naver-site-verification": naver } } : {}),
  };
}

/** Safe for embedding JSON-LD in a script element, including story titles. */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
