import { inject, Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { BackendService } from '../backend/backend.service';
import { FilterOperator } from '../../enums/filterOperator';
import { toSnakeCase } from '../../utils/type-mappers';
import { EventDbJoined } from '../../interfaces/i-events';
import { IFilters } from '../../interfaces/i-filters';

@Injectable({ providedIn: 'root' })
export class EventRepository {
  private readonly backend = inject(BackendService);

  getAllActive() {
    return this.backend.getAll<EventDbJoined>(
      'new_events',
      'name',
      'asc',
      { filters: { isActive: { operator: FilterOperator.EQ, value: true } } as IFilters },
      undefined,
      'event_tags(*), event_rooms(*), event_recurrence(*), event_room_plans(*), event_room_slots(*)',
      true
    );
  }

  getBySlug(slug: string) {
    return this.backend.getAll<EventDbJoined>(
      'new_events',
      undefined,
      'asc',
      { filters: { slug: { operator: FilterOperator.EQ, value: slug } } as IFilters },
      undefined,
      'event_tags(*), event_rooms(*), event_recurrence(*), event_room_plans(*), event_room_slots(*)',
      true
    );
  }

  getById(id: string) {
    return this.backend.getAll<EventDbJoined>(
      'new_events',
      undefined,
      'asc',
      { filters: { id: { operator: FilterOperator.EQ, value: id } } as IFilters },
      undefined,
      'event_tags(*), event_rooms(*), event_recurrence(*), event_room_plans(*), event_room_slots(*)',
      true
    );
  }

  createCore(table: string, core: Record<string, unknown>) {
    return this.backend.create(table, toSnakeCase(core));
  }

  updateCore(table: string, id: string, patch: Record<string, unknown>) {
    return this.backend.update(table, id, toSnakeCase(patch) as any);
  }

  upsert(table: string, row: Record<string, unknown>, conflictCols: string) {
    return this.backend.upsert(table, row as any, conflictCols);
  }

  createMany<T extends object>(table: string, rows: T[]) {
    return rows.length ? this.backend.createMany(table, rows as any) : of(void 0);
  }

  deleteWhere(table: string, where: IFilters) {
    return this.backend.delete(table, where as any);
  }

  replaceRelations(
    parentId: string,
    opts: Array<{ table: string; whereCol: string; rows: Record<string, unknown>[] }>
  ): Observable<void> {
    if (!opts.length) return of(void 0);
    const ops = opts.map(({ table, whereCol, rows }) =>
      this.deleteWhere(table, { [whereCol]: { operator: FilterOperator.EQ, value: parentId } } as IFilters)
        .pipe(switchMap(() => this.createMany(table, rows)))
    );
    return forkJoin(ops).pipe(map(() => void 0));
  }

  ensureReservationsUpsert(rows: Array<{
    eventId: string; roomName: string; date: string; startTime: string; durationHours: number; status: 'confirmed';
  }>) {
    if (!rows.length) return of(void 0);
    return this.backend
      .upsertMany('reservations', rows as any, 'event_id,room_name,date,start_time')
      .pipe(map(() => void 0));
  }

  cleanFutureReservations(eventId: string, fromIso: string) {
    return this.deleteWhere('reservations', {
      eventId: { operator: FilterOperator.EQ, value: eventId },
      date: { operator: FilterOperator.GTE, value: fromIso },
    } as IFilters);
  }

  getHostsRange(filters: IFilters) {
    return this.backend.getAll<{ eventId: string; occurrenceDate: string; roomName: string | null }>(
      'event_occurrence_hosts',
      undefined,
      'asc',
      { filters },
    );
  }
}
