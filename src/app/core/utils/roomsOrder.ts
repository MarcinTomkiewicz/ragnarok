// rooms-order.util.ts
const FIXED_ORDER = ['Midgard', 'Asgard', 'Alfheim', 'Jotunheim'] as const;

const norm = (s: string) => (s ?? '').trim().toLowerCase();

export function roomsOrder(rooms: string[]): string[] {
  const orderMap = new Map(FIXED_ORDER.map((n, i) => [norm(n), i]));
  const seen = new Set<string>();

  const items = (rooms ?? [])
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((name, idx) => {
      const key = norm(name);
      return {
        name: name.trim(),
        key,
        rank: orderMap.has(key) ? (orderMap.get(key) ?? 0) : 999,
        idx,
      };
    });

  items.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    // dla nieznanych (rank 999) — sort alfabetyczny po nazwie
    if (a.rank === 999 && b.rank === 999) {
      const cmp = a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
    // stabilizator
    return a.idx - b.idx;
  });

  // deduplikacja, zachowaj pierwsze wystąpienie w posortowanej liście
  const out: string[] = [];
  for (const it of items) {
    if (!seen.has(it.key)) {
      seen.add(it.key);
      out.push(it.name);
    }
  }
  return out;
}
