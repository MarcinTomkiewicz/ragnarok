#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL =
  process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
  (() => {
    throw new Error("Missing PUBLIC_BASE_URL");
  })();

const distBrowser = resolve(__dirname, "..", "dist", "ragnarok", "browser");
mkdirSync(distBrowser, { recursive: true });

const staticRoutes = [
  "/",
  "/about",
  "/services",
  "/our-rooms",
  "/contact",
  "/tech-stack",
  "/for-beginners",
  "/events",
  "/offers-list",
  "/memberships",
];

const dyn = {
  events: readJsonArray("dynamic/events.json"),
  offers: readJsonArray("dynamic/offers.json"),
  offersPage: readJsonArray("dynamic/offers-slugs.json"),
  specials: readJsonArray("dynamic/specials.json"),
};

function readJsonArray(rel) {
  const p = resolve(__dirname, rel);
  if (!existsSync(p)) return [];
  try {
    const v = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const urls = new Set(staticRoutes.map((p) => `${BASE_URL}${p}`));
dyn.events.forEach((slug) =>
  urls.add(`${BASE_URL}/events/${encodeURIComponent(slug)}`)
);
dyn.offers.forEach((id) =>
  urls.add(`${BASE_URL}/offer/${encodeURIComponent(id)}`)
);
dyn.offersPage.forEach((slug) =>
  urls.add(`${BASE_URL}/offers/${encodeURIComponent(slug)}`)
);
dyn.specials.forEach((id) =>
  urls.add(`${BASE_URL}/special/${encodeURIComponent(id)}`)
);

const now = new Date().toISOString();
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  Array.from(urls)
    .sort()
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${u}</loc>\n` +
        `    <lastmod>${now}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>${u === `${BASE_URL}/` ? "1.0" : "0.7"}</priority>\n` +
        `  </url>`
    )
    .join("\n") +
  `\n</urlset>\n`;

writeFileSync(resolve(distBrowser, "sitemap.xml"), sitemap, "utf-8");

const robots = `User-agent: *
Disallow: /admin
Disallow: /auth
Sitemap: ${BASE_URL}/sitemap.xml
`;

writeFileSync(resolve(distBrowser, "robots.txt"), robots, "utf-8");

console.log(
  `[seo] generated ${urls.size} urls -> dist/ragnarok/browser/sitemap.xml & robots.txt`
);
