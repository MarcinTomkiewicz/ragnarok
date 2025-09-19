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

const dynEvents = readJsonArray("dynamic/events.json");
const dynOffers = readJsonArray("dynamic/offers.json");
const dynOffersPages = readJsonArray("dynamic/offers-slugs.json");
const dynSpecials = readJsonArray("dynamic/specials.json");

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

const now = new Date().toISOString();

const entries = [];

for (const p of staticRoutes) {
  entries.push({
    loc: `${BASE_URL}${p}`,
    lastmod: now,
    prio: p === "/" ? "1.0" : "0.7",
  });
}

for (const e of dynEvents) {
  const slug = typeof e === "string" ? e : e.slug;
  const lm = typeof e === "string" ? undefined : e.lastmod;
  if (!slug) continue;
  entries.push({
    loc: `${BASE_URL}/events/${encodeURIComponent(slug)}`,
    lastmod: lm ?? now,
    prio: "0.7",
  });
}

for (const o of dynOffers) {
  const id = typeof o === "string" || typeof o === "number" ? o : o.id;
  const lm = typeof o === "object" ? o.lastmod : undefined;
  if (id === undefined || id === null) continue;
  entries.push({
    loc: `${BASE_URL}/offer/${encodeURIComponent(id)}`,
    lastmod: lm ?? now,
    prio: "0.7",
  });
}

for (const op of dynOffersPages) {
  const slug = typeof op === "string" ? op : op.slug;
  const lm = typeof op === "string" ? undefined : op.lastmod;
  if (!slug) continue;
  entries.push({
    loc: `${BASE_URL}/offers/${encodeURIComponent(slug)}`,
    lastmod: lm ?? now,
    prio: "0.7",
  });
}

for (const s of dynSpecials) {
  const id = typeof s === "string" || typeof s === "number" ? s : s.id;
  const lm = typeof s === "object" ? s.lastmod : undefined;
  if (id === undefined || id === null) continue;
  entries.push({
    loc: `${BASE_URL}/special/${encodeURIComponent(id)}`,
    lastmod: lm ?? now,
    prio: "0.7",
  });
}

const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map(
      ({ loc, lastmod, prio }) =>
        `  <url>\n` +
        `    <loc>${loc}</loc>\n` +
        `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>${prio}</priority>\n` +
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
  `[seo] generated ${entries.length} urls -> dist/ragnarok/browser/sitemap.xml & robots.txt`
);
