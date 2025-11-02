import { formatYmdLocal } from './weekday-options';

/** Sprawdza czy string jest w formacie ISO YYYY-MM-DD */
export function isIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Zwraca datę o `days` dni późniejszą jako ISO YYYY-MM-DD */
export function addDaysIso(isoYmd: string, days: number): string {
  const d = new Date(`${isoYmd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatYmdLocal(d);
}

/** Zwraca ostatni dzień następnego miesiąca po dacie `isoYmd` */
export function endOfNextMonthIso(isoYmd: string): string {
  const d = new Date(`${isoYmd}T00:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  d.setDate(0);
  return formatYmdLocal(d);
}
