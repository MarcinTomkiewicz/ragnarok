import { Injectable, inject } from '@angular/core';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { Observable, of, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { IWorkLog } from '../../../../core/interfaces/i-work-log';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { toSnakeCase, toCamelCase } from '../../../../core/utils/type-mappers';

@Injectable({ providedIn: 'root' })
export class WorkLogService {
  private readonly backend = inject(BackendService);
  private readonly table = 'user_work_log';

  getForDates(userId: string, dates: string[]): Observable<IWorkLog[]> {
    if (!dates.length) return of([]);
    return this.backend.getAll<IWorkLog>(this.table, undefined, 'asc', {
      filters: {
        userId:   { operator: FilterOperator.EQ, value: userId },
        workDate: { operator: FilterOperator.IN, value: dates },
      },
    });
  }

  getForMonth(userId: string, monthOffset: 0 | -1): Observable<IWorkLog[]> {
    const { days } = this.computeMonthDays(monthOffset);
    return this.getForDates(userId, days);
  }

  upsert(entry: IWorkLog): Observable<IWorkLog> {
    const { id, userId, workDate, hours, comment } = entry;
    const base = { userId, workDate, hours, comment: comment ?? null };
    const payload = toSnakeCase(id ? { id, ...base } : base);
    return this.backend
      .upsert<IWorkLog>(this.table, payload as any, 'user_id,work_date')
      .pipe(map(row => toCamelCase<IWorkLog>(row)));
  }

  upsertMany(entries: IWorkLog[]): Observable<IWorkLog[]> {
    if (!entries.length) return of([]);

    const withId = entries
      .filter(e => !!e.id)
      .map(e => toSnakeCase({
        id: e.id,
        userId: e.userId,
        workDate: e.workDate,
        hours: e.hours,
        comment: e.comment ?? null,
      }));

    const withoutId = entries
      .filter(e => !e.id)
      .map(e => toSnakeCase({
        userId: e.userId,
        workDate: e.workDate,
        hours: e.hours,
        comment: e.comment ?? null,
      }));

    const reqs: Observable<IWorkLog[]>[] = [];
    if (withId.length)    reqs.push(this.backend.upsertMany<IWorkLog>(this.table, withId as any, 'id'));
    if (withoutId.length) reqs.push(this.backend.upsertMany<IWorkLog>(this.table, withoutId as any, 'user_id,work_date'));

    return reqs.length === 1 ? reqs[0] : combineLatest(reqs).pipe(map(r => r.flat()));
  }

  deleteByDates(userId: string, dates: string[]): Observable<void> {
    if (!dates.length) return of(void 0);
    return this.backend.delete(this.table, {
      user_id:  { operator: FilterOperator.EQ, value: userId },
      work_date:{ operator: FilterOperator.IN, value: dates },
    });
  }

  computeMonthDays(monthOffset: 0 | -1): { start: Date; end: Date; days: string[] } {
    const base = new Date();
    const start = startOfMonth(new Date(base.getFullYear(), base.getMonth() + monthOffset, 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
    return { start, end, days };
  }
}
