import { addDays, format, startOfWeek } from 'date-fns';
import { pl } from 'date-fns/locale';

export function weekdayOptionsPl(): { value: number; label: string }[] {
  const base = startOfWeek(new Date(), { weekStartsOn: 1 });
  const map = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const d = addDays(base, dow === 0 ? 6 : dow - 1);
    return { value: dow, label: format(d, 'EEEE', { locale: pl }) };
  });
  const sun = {
    value: 0,
    label: format(addDays(base, 6), 'EEEE', { locale: pl }),
  };
  const rest = [1, 2, 3, 4, 5, 6].map((v) => map.find((m) => m.value === v)!);
  return [sun, ...rest];
}

export function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
