#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { resolveSiteUrl } from "../config/site-url.js";

// Inspect the actual build output: helper unit tests cannot catch Next title
// inheritance or a public route accidentally inheriting private metadata.
const site = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
const sitemap = new JSDOM(await readFile("public/sitemap-0.xml", "utf8"), {
  contentType: "application/xml",
});
const urls = Array.from(
  sitemap.window.document.querySelectorAll("url > loc"),
  element => new URL(element.textContent),
);
sitemap.window.close();
assert(urls.length > 0, "Search sitemap must contain public pages");
assert.equal(
  new Set(urls.map(url => url.href)).size,
  urls.length,
  "Duplicate sitemap URL",
);

const privatePath =
  /^\/(api|auth|sign-in|profile|my-story|payment|payment-history|bead|service|hodam)(\/|$)/;
const titles = new Set();
const descriptions = new Set();
for (const url of urls) {
  assert.equal(
    url.origin,
    site,
    "Sitemap must use the configured production origin",
  );
  assert(
    !url.search && !url.hash,
    "Sitemap URL must not contain queries or fragments",
  );
  assert(
    !privatePath.test(url.pathname),
    `Private URL in sitemap: ${url.pathname}`,
  );
  assert(
    !url.pathname.includes("%"),
    "Sitemap path must not contain encoded file paths",
  );
  const relative = url.pathname === "/" ? "index" : url.pathname.slice(1);
  const html = await readFile(
    path.join(".next/server/app", `${relative}.html`),
    "utf8",
  );
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const title = doc.title.trim();
  const description = doc
    .querySelector('meta[name="description"]')
    ?.content?.trim();
  const canonical = doc.querySelectorAll('link[rel="canonical"]');
  const robots = Array.from(
    doc.querySelectorAll('meta[name="robots"], meta[name="googlebot"]'),
    element => element.content,
  ).join(",");
  assert(
    title.includes("호담") && !titles.has(title),
    `Missing brand or duplicate title: ${url.pathname}`,
  );
  assert(
    description && !descriptions.has(description),
    `Missing or duplicate description: ${url.pathname}`,
  );
  assert.equal(canonical.length, 1, `Expected one canonical: ${url.pathname}`);
  assert.equal(
    canonical[0].href,
    url.href,
    `Incorrect canonical: ${url.pathname}`,
  );
  assert(
    !/(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(robots),
    `Public page blocks indexing: ${url.pathname}`,
  );
  assert.equal(
    doc.querySelectorAll("h1").length,
    1,
    `Expected one rendered heading: ${url.pathname}`,
  );
  if (url.pathname.startsWith("/bedtime-stories/")) {
    assert.equal(
      doc.querySelectorAll(".public-story-passage").length,
      8,
      `Missing server-rendered story: ${url.pathname}`,
    );
    const article = Array.from(
      doc.querySelectorAll('script[type="application/ld+json"]'),
    )
      .map(element => JSON.parse(element.textContent))
      .find(item => item["@type"] === "Article");
    assert(
      article?.articleBody?.length > 0,
      `Missing story structured data: ${url.pathname}`,
    );
  }
  titles.add(title);
  descriptions.add(description);
  dom.window.close();
}
const { routes } = JSON.parse(
  await readFile(".next/prerender-manifest.json", "utf8"),
);
const storyRoutes = Object.keys(routes).filter(route =>
  route.startsWith("/bedtime-stories/"),
);
assert(storyRoutes.length > 0, "Public stories must be prerendered");
for (const required of [
  "/",
  "/bedtime-stories",
  "/ai-storybook",
  "/sample",
  ...storyRoutes,
]) {
  assert(
    urls.some(url => url.pathname === required),
    `Missing public route: ${required}`,
  );
}
for (const route of [
  "my-story",
  "my-story/archive",
  "service",
  "sign-in",
  "profile",
  "bead",
  "payment-history",
]) {
  const dom = new JSDOM(
    await readFile(`.next/server/app/${route}.html`, "utf8"),
  );
  assert(
    /\bnoindex\b/.test(
      dom.window.document.querySelector('meta[name="robots"]')?.content ?? "",
    ),
    `Private page must remain noindex: /${route}`,
  );
  dom.window.close();
}
console.log(
  `check-search-artifacts: ${urls.length} public pages and 7 private pages passed.`,
);
