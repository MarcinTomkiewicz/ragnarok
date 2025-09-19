#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("SUPABASE_URL or SUPABASE_*_KEY not set");
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const outDir = resolve(__dirname, "dynamic");
mkdirSync(outDir, { recursive: true });

async function main() {
  const events = await selectMap(
    sb.from("new_events").select("slug,updated_at").eq("is_active", true),
    r => ({ slug: r.slug, lastmod: r.updated_at ?? undefined })
  );

  const offers = await selectMap(
    sb.from("offers").select("id").eq("is_active", true),
    r => ({ id: r.id })
  );

  const offersSlugs = await selectMap(
    sb.from("offer_pages").select("slug,created_at"),
    r => ({ slug: r.slug, lastmod: r.created_at ?? undefined })
  );

  const specials = await selectMap(
    sb.from("specials").select("id").eq("active", true),
    r => ({ id: r.id })
  );

  writeJson("events.json", events);
  writeJson("offers.json", offers);
  writeJson("offers-slugs.json", offersSlugs);
  writeJson("specials.json", specials);

  console.log(
    `[dynamic] events=${events.length} offers=${offers.length} offersSlugs=${offersSlugs.length} specials=${specials.length}`
  );
}

async function selectMap(q, map) {
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(map);
}

function writeJson(name, arr) {
  writeFileSync(resolve(outDir, name), JSON.stringify(arr, null, 2), "utf-8");
}

main().catch((e) => {
  console.error("[dynamic] error", e);
  process.exit(1);
});
