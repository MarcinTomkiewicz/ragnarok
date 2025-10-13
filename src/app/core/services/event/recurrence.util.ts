import { Injectable } from '@angular/core';
import { RecurrenceRule } from '../../interfaces/i-events';
import { RecurrenceKind } from '../../enums/events';
import { formatYmdLocal } from '../../utils/weekday-options';

@Injectable({ providedIn: 'root' })
export class RecurrenceUtil {
  list(r: RecurrenceRule, from: Date, to: Date): string[] {
    const out: string[] = [];
    const clip = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    const start = r.startDate ? new Date(r.startDate + 'T00:00:00') : from;
    const end = r.endDate ? new Date(r.endDate + 'T00:00:00') : to;
    const rangeFrom = from > start ? from : start;
    const rangeTo = to < end ? to : end;

    const ex = new Set((r.exdates ?? []).map((x) => x));

    if (r.kind === RecurrenceKind.Weekly && r.byweekday?.length) {
      for (let d = new Date(rangeFrom); d <= rangeTo; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (!r.byweekday.includes(dow)) continue;
        const weeksFromStart = Math.floor((clip(d).getTime() - clip(start).getTime()) / (7 * 24 * 3600 * 1000));
        if (weeksFromStart % Math.max(1, r.interval) !== 0) continue;
        const iso = formatYmdLocal(d);
        if (!ex.has(iso)) out.push(iso);
      }
    }

    if (r.kind === RecurrenceKind.MonthlyNthWeekday && r.monthlyNth && (r.monthlyWeekday ?? -10) >= 0) {
      const m = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), 1);
      while (m <= rangeTo) {
        const nth = this.nthWeekdayOfMonth(m.getFullYear(), m.getMonth(), r.monthlyWeekday!, r.monthlyNth);
        if (nth && nth >= rangeFrom && nth <= rangeTo) {
          const iso = formatYmdLocal(nth);
          if (!ex.has(iso)) out.push(iso);
        }
        m.setMonth(m.getMonth() + Math.max(1, r.interval));
      }
    }

    if (r.kind === RecurrenceKind.MonthlyDayOfMonth && r.dayOfMonth) {
      const interval = Math.max(1, r.interval || 1);
      const firstMonth = new Date(start.getFullYear(), start.getMonth(), 1);

      for (let m = new Date(firstMonth); m <= rangeTo; m.setMonth(m.getMonth() + 1)) {
        const monthsFromStart =
          (m.getFullYear() - firstMonth.getFullYear()) * 12 + (m.getMonth() - firstMonth.getMonth());
        if (monthsFromStart % interval !== 0) continue;

        const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        if (r.dayOfMonth >= 1 && r.dayOfMonth <= lastDay) {
          const d = new Date(m.getFullYear(), m.getMonth(), r.dayOfMonth);
          if (d >= rangeFrom && d <= rangeTo) {
            const iso = formatYmdLocal(d);
            if (!ex.has(iso)) out.push(iso);
          }
        }
      }
    }
    return out;
  }

  private nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date | null {
    if (n > 0) {
      const first = new Date(year, month0, 1);
      const shift = (weekday - first.getDay() + 7) % 7;
      const day = 1 + shift + (n - 1) * 7;
      const d = new Date(year, month0, day);
      return d.getMonth() === month0 ? d : null;
    }
    if (n === -1) {
      const last = new Date(year, month0 + 1, 0);
      const shiftBack = (last.getDay() - weekday + 7) % 7;
      const day = last.getDate() - shiftBack;
      return new Date(year, month0, day);
    }
    return null;
  }
}
