import { Injectable, inject } from '@angular/core';
import { BackendService } from '../backend/backend.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Observable,
  forkJoin,
  from,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import { FilterOperator } from '../../enums/filterOperator';
import { toSnakeCase } from '../../utils/type-mappers';
import { EventFull, RecurrenceRule } from '../../interfaces/i-events';
import { formatYmdLocal } from '../../utils/weekday-options';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';

type EventForCreate = Omit<EventFull, 'id'>;

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly backend = inject(BackendService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly images = inject(ImageStorageService);

  getAllActive(): Observable<EventFull[]> {
    return from(
      this.supabase
        .from('new_events')
        .select('*, event_tags(*), event_rooms(*), event_recurrence(*)')
        .eq('is_active', true)
        .order('name', { ascending: true })
    ).pipe(map((res) => (res.data ?? []).map((r) => this.mapDbToEventFull(r))));
  }

  getBySlug(slug: string): Observable<EventFull | null> {
    return from(
      this.supabase
        .from('new_events')
        .select('*, event_tags(*), event_rooms(*), event_recurrence(*)')
        .eq('slug', slug)
        .maybeSingle()
    ).pipe(map((res) => (res.data ? this.mapDbToEventFull(res.data) : null)));
  }

  createEvent(
    payload: EventForCreate,
    coverFile?: File,
    regenMode: 'APPEND_ONLY' | 'REPLACE_FUTURE' = 'REPLACE_FUTURE',
    opts?: { blockSlots?: boolean }
  ): Observable<{ id: string; slug: string }> {
    const { recurrence, tags = [], rooms = [], ...coreRaw } = payload as any;
    const core = { ...coreRaw };

    return from(
      this.supabase
        .from('new_events')
        .insert(toSnakeCase(core))
        .select('id,slug')
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error || !data?.id)
          return throwError(
            () => error ?? new Error('Insert new_events failed')
          );
        const eventId = data.id as string;

        const writes: Observable<unknown>[] = [];
        if (tags.length) {
          writes.push(
            this.backend.createMany(
              'event_tags',
              tags.map((tag: string) => ({ event_id: eventId, tag }))
            )
          );
        }
        if (rooms.length) {
          writes.push(
            this.backend.createMany(
              'event_rooms',
              rooms.map((room_name: string) => ({
                event_id: eventId,
                room_name,
              }))
            )
          );
        }
        if (recurrence) {
          writes.push(
            this.backend.create('event_recurrence', {
              event_id: eventId,
              kind: recurrence.kind,
              interval: recurrence.interval,
              byweekday: recurrence.byweekday ?? null,
              monthly_nth: recurrence.monthlyNth ?? null,
              monthly_weekday: recurrence.monthlyWeekday ?? null,
              start_date: recurrence.startDate,
              end_date: recurrence.endDate ?? null,
              exdates: recurrence.exdates ?? [],
            })
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
          map(() => ({ id: eventId, slug: data.slug as string }))
        );
      })
    );
  }

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
          .update<Record<string, unknown>>(
            'new_events',
            id,
            toSnakeCase(core) as any
          )
          .pipe(map(() => void 0))
      );
    }

    if (Array.isArray(tags)) {
      ops.push(
        this.backend
          .delete('event_tags', {
            event_id: { operator: FilterOperator.EQ, value: id },
          } as any)
          .pipe(
            switchMap(() =>
              tags.length
                ? this.backend.createMany(
                    'event_tags',
                    tags.map((t) => ({ event_id: id, tag: t }))
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
            event_id: { operator: FilterOperator.EQ, value: id },
          } as any)
          .pipe(
            switchMap(() =>
              rooms.length
                ? this.backend.createMany(
                    'event_rooms',
                    rooms.map((r) => ({ event_id: id, room_name: r }))
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
              event_id: { operator: FilterOperator.EQ, value: id },
            } as any)
            .pipe(map(() => void 0))
        );
      } else {
        ops.push(
          this.backend
            .upsert(
              'event_recurrence',
              {
                event_id: id,
                kind: recurrence.kind,
                interval: recurrence.interval,
                byweekday: recurrence.byweekday ?? null,
                monthly_nth: recurrence.monthlyNth ?? null,
                monthly_weekday: recurrence.monthlyWeekday ?? null,
                start_date: recurrence.startDate,
                end_date: recurrence.endDate ?? null,
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

  getById(id: string): Observable<EventFull | null> {
    return from(
      this.supabase
        .from('new_events')
        .select('*, event_tags(*), event_rooms(*), event_recurrence(*)')
        .eq('id', id)
        .maybeSingle()
    ).pipe(map((res) => (res.data ? this.mapDbToEventFull(res.data) : null)));
  }

  private uploadCover(eventId: string, file: File): Observable<void> {
    const basePath = `events/${eventId}`;
    return this.images.uploadOrReplaceImage(file, basePath, null).pipe(
      switchMap((fullPath) =>
        this.backend.update('new_events', eventId, {
          cover_image_path: fullPath,
        } as any)
      ),
      map(() => void 0)
    );
  }

  listOccurrencesFE(ev: EventFull, fromIso: string, toIso: string): string[] {
    const out: string[] = [];
    const fromD = new Date(fromIso + 'T00:00:00');
    const toD = new Date(toIso + 'T00:00:00');

    if (ev.singleDate) {
      const d = new Date(ev.singleDate + 'T00:00:00');
      if (d >= fromD && d <= toD) out.push(ev.singleDate);
    }
    if (ev.recurrence) {
      out.push(...this.expandRecurrence(ev.recurrence, fromD, toD));
    }
    return Array.from(new Set(out)).sort();
  }

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
            event_id: { operator: FilterOperator.EQ, value: ev.id },
            date: { operator: FilterOperator.GTE, value: todayIso },
          } as any)
        : of(void 0);

    const rows = (ev.rooms ?? []).flatMap((room) =>
      dates.map((date) => ({
        event_id: ev.id,
        room_name: room,
        date,
        start_time: start,
        duration_hours: durHours,
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

  private mapDbToEventFull(row: any): EventFull {
    const tags = (row.event_tags ?? []).map((t: any) => t.tag);
    const rooms = (row.event_rooms ?? []).map((r: any) => r.room_name);
    const rec = row.event_recurrence
      ? ({
          kind: row.event_recurrence.kind,
          interval: row.event_recurrence.interval,
          byweekday: row.event_recurrence.byweekday ?? undefined,
          monthlyNth: row.event_recurrence.monthly_nth ?? undefined,
          monthlyWeekday: row.event_recurrence.monthly_weekday ?? undefined,
          startDate: row.event_recurrence.start_date,
          endDate: row.event_recurrence.end_date ?? undefined,
          exdates: row.event_recurrence.exdates ?? [],
        } as RecurrenceRule)
      : undefined;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description,
      longDescription: row.long_description,
      coverImagePath: row.cover_image_path ?? undefined,
      facebookLink: row.facebook_link ?? undefined,
      isActive: row.is_active,
      isForBeginners: row.is_for_beginners,
      requiresHosts: row.requires_hosts,
      attractionType: row.attraction_type,
      hostSignup: row.host_signup,
      timezone: row.timezone,
      startTime: row.start_time,
      endTime: row.end_time,
      singleDate: row.single_date ?? undefined,
      tags,
      rooms,
      entryFeePln: Number(row.entry_fee_pln ?? 0),
      recurrence: rec,
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
