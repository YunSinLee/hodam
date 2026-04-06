#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const sitemapPath = path.join(cwd, "public", "sitemap-0.xml");

function normalizeSitemap(content) {
  const lines = content.split(/\r?\n/);
  const header = lines.filter(line => !line.startsWith("<url><loc>"));
  const urlLines = lines.filter(line => line.startsWith("<url><loc>"));

  const normalizedUrlLines = Array.from(new Set(urlLines))
    .map(line => line.replace(/<lastmod>[^<]+<\/lastmod>/g, ""))
    .sort((left, right) => {
      const leftLoc = left.match(/<loc>([^<]+)<\/loc>/)?.[1] || "";
      const rightLoc = right.match(/<loc>([^<]+)<\/loc>/)?.[1] || "";
      return leftLoc.localeCompare(rightLoc);
    });

  const openTagIndex = header.findIndex(line => line.startsWith("<urlset "));
  const closeTagIndex = header.findIndex(line => line.startsWith("</urlset>"));

  if (openTagIndex === -1 || closeTagIndex === -1 || closeTagIndex < openTagIndex) {
    throw new Error("Unexpected sitemap format: missing <urlset> wrapper");
  }

  const before = header.slice(0, openTagIndex + 1);
  const after = header.slice(closeTagIndex);
  return [...before, ...normalizedUrlLines, ...after].join("\n");
}

function main() {
  if (!fs.existsSync(sitemapPath)) {
    console.log("normalize-sitemap: sitemap-0.xml not found, skipping.");
    return;
  }

  const current = fs.readFileSync(sitemapPath, "utf8");
  const normalized = normalizeSitemap(current);

  if (normalized === current) {
    console.log("normalize-sitemap: already normalized.");
    return;
  }

  fs.writeFileSync(sitemapPath, normalized, "utf8");
  console.log("normalize-sitemap: normalized public/sitemap-0.xml");
}

main();
