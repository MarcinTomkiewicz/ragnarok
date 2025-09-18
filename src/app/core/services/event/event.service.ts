import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, switchMap, throwError, map } from 'rxjs';
import { BackendService } from '../backend/backend.service';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';
import { FilterOperator } from '../../enums/filterOperator';
import { toSnakeCase } from '../../utils/type-mappers';
import { EventFull, RecurrenceRule } from '../../interfaces/i-events';
import { formatYmdLocal } from '../../utils/weekday-options';
import { EventTag } from '../../enums/events';

type EventForCreate = Omit<EventFull, 'id'>;

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly backend = inject(BackendService);
  private readonly images = inject(ImageStorageService);

  /** LISTA AKTYWNYCH + joiny przez BackendService */
  getAllActive(): Observable<EventFull[]> {
    return this.backend
      .getAll<any>(
        'new_events',
        'name',
        'asc',
        {
          filters: {
            isActive: { operator: FilterOperator.EQ, value: true },
          },
        },
        undefined,
        'event_tags(*), event_rooms(*), event_recurrence(*)',
        true // processImages
      )
      .pipe(map((rows) => rows.map((r) => this.mapDbCamelToEventFull(r))));
  }

  /** POBIERZ PO SLUGU + joiny przez BackendService */
  getBySlug(slug: string): Observable<EventFull | null> {
    return this.backend
      .getAll<any>(
        'new_events',
        undefined,
        'asc',
        {
          filters: {
            slug: { operator: FilterOperator.EQ, value: slug },
          },
        },
        undefined,
        'event_tags(*), event_rooms(*), event_recurrence(*)',
        true
      )
      .pipe(
        map((rows) => (rows[0] ? this.mapDbCamelToEventFull(rows[0]) : null))
      );
  }

  /** POBIERZ PO ID + joiny przez BackendService */
  getById(id: string): Observable<EventFull | null> {
    return this.backend
      .getAll<any>(
        'new_events',
        undefined,
        'asc',
        {
          filters: {
            id: { operator: FilterOperator.EQ, value: id },
          },
        },
        undefined,
        'event_tags(*), event_rooms(*), event_recurrence(*)',
        true
      )
      .pipe(
        map((rows) => (rows[0] ? this.mapDbCamelToEventFull(rows[0]) : null))
      );
  }

  /** CREATE przez BackendService, potem joinowe dopiski też BackendService */
  createEvent(
    payload: EventForCreate,
    coverFile?: File,
    regenMode: 'APPEND_ONLY' | 'REPLACE_FUTURE' = 'REPLACE_FUTURE',
    opts?: { blockSlots?: boolean }
  ): Observable<{ id: string; slug: string }> {
    const { recurrence, tags = [], rooms = [], ...coreRaw } = payload as any;
    const core = { ...coreRaw };

    return this.backend.create('new_events', toSnakeCase(core)).pipe(
      switchMap((created: any) => {
        const eventId = created?.id as string | undefined;
        const slug = created?.slug as string | undefined;
        if (!eventId) {
          return throwError(() => new Error('Insert new_events failed'));
        }

        const writes: Observable<unknown>[] = [];
        if (tags.length) {
          writes.push(
            this.backend.createMany(
              'event_tags',
              tags.map((tag: string) => ({ eventId, tag } as any))
            )
          );
        }
        if (rooms.length) {
          writes.push(
            this.backend.createMany(
              'event_rooms',
              rooms.map((roomName: string) => ({ eventId, roomName } as any))
            )
          );
        }
        if (recurrence) {
          writes.push(
            this.backend.create('event_recurrence', {
              eventId,
              kind: recurrence.kind,
              interval: recurrence.interval,
              byweekday: recurrence.byweekday ?? null,
              monthlyNth: recurrence.monthlyNth ?? null,
              monthlyWeekday: recurrence.monthlyWeekday ?? null,
              startDate: recurrence.startDate,
              endDate: recurrence.endDate ?? null,
              exdates: recurrence.exdates ?? [],
            } as any)
          );
        }

        const writes$ = writes.length
          ? forkJoin(writes).pipe(map(() => void 0))
          : of(void 0);

        const fullEv: EventFull = {
          ...(payload as any),
          id: eventId,
          tags,
          rooms,
          recurrence,
        };

        return writes$.pipe(
          switchMap(() =>
            coverFile ? this.uploadCover(eventId, coverFile) : of(void 0)
          ),
          switchMap(() =>
            opts?.blockSlots === false
              ? of(void 0)
              : this.ensureReservationsClient(fullEv, regenMode)
          ),
          map(() => ({ id: eventId, slug: slug as string }))
        );
      })
    );
  }

  /** UPDATE przez BackendService; relacje również BackendService */
  updateEvent(
    id: string,
    patch: Partial<EventFull> & { recurrence?: RecurrenceRule | null },
    coverFile?: File,
    regenMode: 'APPEND_ONLY' | 'REPLACE_FUTURE' = 'REPLACE_FUTURE',
    opts?: { blockSlots?: boolean }
  ): Observable<void> {
    const { recurrence, tags, rooms, ...core } = patch;
    const ops: Observable<void>[] = [];

    if (Object.keys(core).length) {
      ops.push(
        this.backend
          .update('new_events', id, toSnakeCase(core) as any)
          .pipe(map(() => void 0))
      );
    }

    if (Array.isArray(tags)) {
      ops.push(
        this.backend
          .delete('event_tags', {
            eventId: { operator: FilterOperator.EQ, value: id },
          } as any)
          .pipe(
            switchMap(() =>
              tags.length
                ? this.backend.createMany(
                    'event_tags',
                    tags.map((t) => ({ eventId: id, tag: t } as any))
                  )
                : of(void 0)
            ),
            map(() => void 0)
          )
      );
    }

    if (Array.isArray(rooms)) {
      ops.push(
        this.backend
          .delete('event_rooms', {
            eventId: { operator: FilterOperator.EQ, value: id },
          } as any)
          .pipe(
            switchMap(() =>
              rooms.length
                ? this.backend.createMany(
                    'event_rooms',
                    rooms.map((r) => ({ eventId: id, roomName: r } as any))
                  )
                : of(void 0)
            ),
            map(() => void 0)
          )
      );
    }

    if (recurrence !== undefined) {
      if (recurrence === null) {
        ops.push(
          this.backend
            .delete('event_recurrence', {
              eventId: { operator: FilterOperator.EQ, value: id },
            } as any)
            .pipe(map(() => void 0))
        );
      } else {
        ops.push(
          this.backend
            .upsert(
              'event_recurrence',
              {
                eventId: id,
                kind: recurrence.kind,
                interval: recurrence.interval,
                byweekday: recurrence.byweekday ?? null,
                monthlyNth: recurrence.monthlyNth ?? null,
                monthlyWeekday: recurrence.monthlyWeekday ?? null,
                startDate: recurrence.startDate,
                endDate: recurrence.endDate ?? null,
                exdates: recurrence.exdates ?? [],
              } as any,
              'event_id'
            )
            .pipe(map(() => void 0))
        );
      }
    }

    const ops$ = ops.length
      ? forkJoin(ops).pipe(map(() => void 0))
      : of(void 0);

    return ops$.pipe(
      switchMap(() =>
        coverFile ? this.uploadCover(id, coverFile) : of(void 0)
      ),
      switchMap(() => this.getById(id)),
      switchMap((full) =>
        full && opts?.blockSlots !== false
          ? this.ensureReservationsClient(full, regenMode)
          : of(void 0)
      ),
      map(() => void 0)
    );
  }

  /** COVER → storage + update przez BackendService */
  private uploadCover(eventId: string, file: File): Observable<void> {
    const basePath = `events/${eventId}/cover`;
    return this.images
      .transcodeAndUpload(file, basePath, {
        keepBaseName: true,
        uniqueStrategy: 'date',
        dateFormat: 'dd-MM-yyyy-HHmmss',
        prefer: 'avif',
        quality: 0.82,
        maxW: 1600,
        maxH: 1200,
        largerFallbackFactor: 1.15,
      })
      .pipe(
        switchMap((fullPath) =>
          this.backend.update('new_events', eventId, {
            coverImagePath: fullPath,
          } as any)
        ),
        map(() => void 0)
      );
  }

  /** Rozwinięcie terminów po stronie FE */
  listOccurrencesFE(ev: EventFull, fromIso: string, toIso: string): string[] {
    const out: string[] = [];
    const fromD = new Date(fromIso + 'T00:00:00');
    const toD = new Date(toIso + 'T00:00:00');

    if (ev.singleDate) {
      const d = new Date(ev.singleDate + 'T00:00:00');
      if (d >= fromD && d <= toD) out.push(ev.singleDate);
    }
    if (ev.recurrence)
      out.push(...this.expandRecurrence(ev.recurrence, fromD, toD));

    return Array.from(new Set(out)).sort();
  }

  /** Auto-rezerwacje — już było na BackendService (zostaje) */
  ensureReservationsClient(
    ev: EventFull,
    mode: 'APPEND_ONLY' | 'REPLACE_FUTURE' = 'REPLACE_FUTURE'
  ): Observable<void> {
    const todayIso = formatYmdLocal(new Date());
    const until = ev.singleDate ?? ev.recurrence?.endDate ?? todayIso;
    const dates = this.listOccurrencesFE(ev, todayIso, until);

    const start = (ev.startTime ?? '00:00:00').slice(0, 5) + ':00';
    const end = (ev.endTime ?? '23:59:00').slice(0, 5) + ':00';
    const durHours = Math.max(1, Math.ceil(this.diffHours(start, end)));

    const clean$ =
      mode === 'REPLACE_FUTURE'
        ? this.backend.delete('reservations', {
            eventId: { operator: FilterOperator.EQ, value: ev.id },
            date: { operator: FilterOperator.GTE, value: todayIso },
          } as any)
        : of(void 0);

    const rows = (ev.rooms ?? []).flatMap((room) =>
      dates.map((date) => ({
        eventId: ev.id,
        roomName: room,
        date,
        startTime: start,
        durationHours: durHours,
        status: 'confirmed',
      }))
    );

    if (!rows.length) return clean$.pipe(map(() => void 0));

    return clean$.pipe(
      switchMap(() =>
        this.backend.upsertMany(
          'reservations',
          rows as any,
          'event_id,room_name,date,start_time'
        )
      ),
      map(() => void 0)
    );
  }

  /** PEŁNOŚĆ prowadzących — przez BackendService */
  getHostFullness(
    ev: EventFull,
    fromIso: string,
    toIso: string
  ): Observable<
    Record<string, { count: number; capacity: number; isFull: boolean }>
  > {
    const rooms = new Set(ev.rooms ?? []);
    const hasRooms = rooms.size > 0;
    const capacity = hasRooms ? rooms.size : 1;

    // backend.getAll nie wspiera dwóch operatorów na jednym polu,
    // więc filtrujemy po GTE w zapytaniu i domykamy zakres po LTE na kliencie.
    return this.backend
      .getAll<any>('event_occurrence_hosts', undefined, 'asc', {
        filters: {
          eventId: { operator: FilterOperator.EQ, value: ev.id },
          occurrenceDate: { operator: FilterOperator.GTE, value: fromIso },
        },
      })
      .pipe(
        map((rows) => rows.filter((r) => r.occurrenceDate <= toIso)),
        map(
          (
            rows: Array<{ occurrenceDate: string; roomName: string | null }>
          ) => {
            const out: Record<
              string,
              { count: number; capacity: number; isFull: boolean }
            > = {};
            if (hasRooms) {
              const byDate = new Map<string, Set<string>>();
              for (const r of rows) {
                const rm = r.roomName ?? '';
                if (!rooms.has(rm)) continue;
                const set = byDate.get(r.occurrenceDate) ?? new Set<string>();
                set.add(rm);
                byDate.set(r.occurrenceDate, set);
              }
              for (const [date, set] of byDate) {
                const count = set.size;
                out[date] = { count, capacity, isFull: count >= capacity };
              }
            } else {
              const dates = new Set(rows.map((r) => r.occurrenceDate));
              for (const date of dates)
                out[date] = { count: 1, capacity: 1, isFull: true };
            }
            return out;
          }
        )
      );
  }

  // EventService: dopisz do klasy

  /** Batch: pełność prowadzących dla wielu eventów w podanym zakresie dat.
   * Zwraca: eventId -> (date -> {count, capacity, isFull})
   */
  getHostFullnessForMany(
    events: EventFull[],
    fromIso: string,
    toIso: string
  ): Observable<
    Record<
      string,
      Record<string, { count: number; capacity: number; isFull: boolean }>
    >
  > {
    if (!events.length) return of({});

    const evById = new Map(events.map((e) => [e.id, e]));
    const eventIds = events.map((e) => e.id);

    return this.backend
      .getAll<any>('event_occurrence_hosts', undefined, 'asc', {
        filters: {
          eventId: { operator: FilterOperator.IN, value: eventIds },
          occurrenceDate: { operator: FilterOperator.GTE, value: fromIso },
        },
      })
      .pipe(
        map((rows) => rows.filter((r) => r.occurrenceDate <= toIso)),
        map(
          (
            rows: Array<{
              eventId: string;
              occurrenceDate: string;
              roomName: string | null;
            }>
          ) => {
            const out: Record<
              string,
              Record<
                string,
                { count: number; capacity: number; isFull: boolean }
              >
            > = {};

            // pomocniczo: pojemność = liczba sal (albo 1 jeśli brak sal)
            const capacityOf = (evId: string) => {
              const ev = evById.get(evId);
              const rooms = ev?.rooms ?? [];
              return rooms.length > 0 ? rooms.length : 1;
            };

            // DISTINCT rooms per (eventId, date)
            const seenRooms = new Map<string, Map<string, Set<string>>>();
            // wariant bez sal: obecność wpisu = 1
            const seenDates = new Map<string, Set<string>>();

            for (const r of rows) {
              const ev = evById.get(r.eventId);
              if (!ev) continue;

              if ((ev.rooms?.length ?? 0) > 0) {
                const allowed = new Set(ev.rooms ?? []);
                const rm = r.roomName ?? '';
                if (!allowed.has(rm)) continue;

                const byDate =
                  seenRooms.get(r.eventId) ?? new Map<string, Set<string>>();
                const set = byDate.get(r.occurrenceDate) ?? new Set<string>();
                set.add(rm);
                byDate.set(r.occurrenceDate, set);
                seenRooms.set(r.eventId, byDate);
              } else {
                const dset = seenDates.get(r.eventId) ?? new Set<string>();
                dset.add(r.occurrenceDate);
                seenDates.set(r.eventId, dset);
              }
            }

            for (const e of events) {
              const cap = capacityOf(e.id);
              const inner: Record<
                string,
                { count: number; capacity: number; isFull: boolean }
              > = {};
              if ((e.rooms?.length ?? 0) > 0) {
                const byDate =
                  seenRooms.get(e.id) ?? new Map<string, Set<string>>();
                for (const [date, set] of byDate) {
                  const count = set.size;
                  inner[date] = { count, capacity: cap, isFull: count >= cap };
                }
              } else {
                const dset = seenDates.get(e.id) ?? new Set<string>();
                for (const date of dset) {
                  inner[date] = { count: 1, capacity: 1, isFull: true };
                }
              }
              out[e.id] = inner;
            }

            return out;
          }
        )
      );
  }

  /** Batch: „moje zgłoszenia” dla usera — zwraca eventId -> (date -> true) */
  getHostDataForMany(
    userId: string,
    eventIds: string[],
    fromIso: string,
    toIso: string
  ): Observable<Record<string, Record<string, true>>> {
    if (!userId || !eventIds.length) return of({});

    return this.backend
      .getAll<any>('event_occurrence_hosts', undefined, 'asc', {
        filters: {
          hostUserId: { operator: FilterOperator.EQ, value: userId },
          eventId: { operator: FilterOperator.IN, value: eventIds },
          occurrenceDate: { operator: FilterOperator.GTE, value: fromIso },
        },
      })
      .pipe(
        map((rows) => rows.filter((r) => r.occurrenceDate <= toIso)),
        map((rows: Array<{ eventId: string; occurrenceDate: string }>) => {
          const out: Record<string, Record<string, true>> = {};
          for (const r of rows) {
            (out[r.eventId] ??= {})[r.occurrenceDate] = true;
          }
          return out;
        })
      );
  }

  // ---------------- priv helpers ----------------

  private mapDbCamelToEventFull(row: any): EventFull {
    const tags: EventTag[] = (row.eventTags ?? []).map((t: any) => t.tag);
    const rooms: string[] = (row.eventRooms ?? []).map((r: any) => r.roomName);

    const recRow = row.eventRecurrence;
    const rec: RecurrenceRule | undefined = recRow
      ? {
          kind: recRow.kind,
          interval: recRow.interval,
          byweekday: recRow.byweekday ?? undefined,
          monthlyNth: recRow.monthlyNth ?? undefined,
          monthlyWeekday: recRow.monthlyWeekday ?? undefined,
          startDate: recRow.startDate,
          endDate: recRow.endDate ?? undefined,
          exdates: recRow.exdates ?? [],
        }
      : undefined;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.shortDescription,
      longDescription: row.longDescription,
      coverImagePath: row.coverImagePath ?? undefined,
      facebookLink: row.facebookLink ?? undefined,
      isActive: !!row.isActive,
      isForBeginners: !!row.isForBeginners,
      requiresHosts: !!row.requiresHosts,
      attractionType: row.attractionType,
      hostSignup: row.hostSignup,
      timezone: row.timezone,
      startTime: row.startTime,
      endTime: row.endTime,
      singleDate: row.singleDate ?? undefined,
      tags,
      rooms,
      entryFeePln: Number(row.entryFeePln ?? 0),
      recurrence: rec,
      autoReservation: !!row.autoReservation,
    };
  }

  private expandRecurrence(r: RecurrenceRule, from: Date, to: Date): string[] {
    const out: string[] = [];
    const clip = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    const start = r.startDate ? new Date(r.startDate + 'T00:00:00') : from;
    const end = r.endDate ? new Date(r.endDate + 'T00:00:00') : to;
    const rangeFrom = from > start ? from : start;
    const rangeTo = to < end ? to : end;

    const ex = new Set((r.exdates ?? []).map((x) => x));

    if (r.kind === 'WEEKLY' && r.byweekday?.length) {
      for (
        let d = new Date(rangeFrom);
        d <= rangeTo;
        d.setDate(d.getDate() + 1)
      ) {
        const dow = d.getDay();
        if (!r.byweekday.includes(dow)) continue;
        const weeksFromStart = Math.floor(
          (clip(d).getTime() - clip(start).getTime()) / (7 * 24 * 3600 * 1000)
        );
        if (weeksFromStart % Math.max(1, r.interval) !== 0) continue;

        const iso = formatYmdLocal(d);
        if (!ex.has(iso)) out.push(iso);
      }
    }

    if (
      r.kind === 'MONTHLY_NTH_WEEKDAY' &&
      r.monthlyNth &&
      (r.monthlyWeekday ?? -10) >= 0
    ) {
      const m = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), 1);
      while (m <= rangeTo) {
        const nth = this.nthWeekdayOfMonth(
          m.getFullYear(),
          m.getMonth(),
          r.monthlyWeekday!,
          r.monthlyNth
        );
        if (nth) {
          if (nth >= rangeFrom && nth <= rangeTo) {
            const iso = formatYmdLocal(nth);
            if (!ex.has(iso)) out.push(iso);
          }
        }
        m.setMonth(m.getMonth() + Math.max(1, r.interval));
      }
    }

    return out;
  }

  private nthWeekdayOfMonth(
    year: number,
    month0: number,
    weekday: number,
    n: number
  ): Date | null {
    if (n > 0) {
      const first = new Date(year, month0, 1);
      const shift = (weekday - first.getDay() + 7) % 7;
      const day = 1 + shift + (n - 1) * 7;
      const d = new Date(year, month0, day);
      return d.getMonth() === month0 ? d : null;
    } else if (n === -1) {
      const last = new Date(year, month0 + 1, 0);
      const shiftBack = (last.getDay() - weekday + 7) % 7;
      const day = last.getDate() - shiftBack;
      return new Date(year, month0, day);
    }
    return null;
  }

  private diffHours(hhmmA: string, hhmmB: string): number {
    const [aH, aM] = hhmmA.split(':').map(Number);
    const [bH, bM] = hhmmB.split(':').map(Number);
    const a = aH + aM / 60;
    const b = bH + bM / 60;
    return Math.max(0, b - a);
  }
}
