import { Injectable, inject } from '@angular/core';
import { Observable, of, map, switchMap, throwError, forkJoin } from 'rxjs';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';
import { EventRepository } from './event.repository';
import { RecurrenceUtil } from './recurrence.util';
import { TimeUtil } from './time.util';
import { ReservationsService } from './reservations.service';

import { EventFull, RecurrenceRule } from '../../interfaces/i-events';
import { formatYmdLocal } from '../../utils/weekday-options';
import { FilterOperator } from '../../enums/filterOperator';
import { EventTag, RecurrenceKind, ParticipantSignupScope, HostSignupScope } from '../../enums/events';
import { RoomPurpose, RoomScheduleKind } from '../../enums/event-rooms';
import { EventMapper } from './event.mapper';

type EventForCreate = Omit<EventFull, 'id'>;

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly repo = inject(EventRepository);
  private readonly mapper = inject(EventMapper);
  private readonly rec = inject(RecurrenceUtil);
  private readonly time = inject(TimeUtil);
  private readonly images = inject(ImageStorageService);
  private readonly reservations = inject(ReservationsService);

  getAllActive(): Observable<EventFull[]> {
    return this.repo.getAllActive().pipe(map((rows) => rows.map((r) => this.mapper.mapDbToEventFull(r))));
  }

  getBySlug(slug: string): Observable<EventFull | null> {
    return this.repo.getBySlug(slug).pipe(map((rows) => (rows[0] ? this.mapper.mapDbToEventFull(rows[0]) : null)));
  }

  getById(id: string): Observable<EventFull | null> {
    return this.repo.getById(id).pipe(map((rows) => (rows[0] ? this.mapper.mapDbToEventFull(rows[0]) : null)));
  }

  createEvent(
    payload: EventForCreate,
    coverFile?: File,
    regenMode: 'APPEND_ONLY' | 'REPLACE_FUTURE' = 'REPLACE_FUTURE',
    opts?: { blockSlots?: boolean }
  ): Observable<{ id: string; slug: string }> {
    const { recurrence, tags = [], rooms = [], roomPlans = null, ...core } = payload as any;

    return this.repo.createCore('new_events', core).pipe(
      switchMap((created: any) => {
        const eventId = created?.id as string | undefined;
        const slug = created?.slug as string | undefined;
        if (!eventId) return throwError(() => new Error('Insert new_events failed'));

        const writes: Observable<unknown>[] = [];

        if (tags.length) {
          const tagRows = tags.map((tag: string) => ({ eventId, tag } as any));
          writes.push(this.repo.createMany('event_tags', tagRows));
        }

        if (rooms.length) {
          const roomRows = rooms.map((roomName: string) => ({ eventId, roomName } as any));
          writes.push(this.repo.createMany('event_rooms', roomRows));
        }

        if (recurrence) {
          const recRow = {
            eventId,
            kind: recurrence.kind,
            interval: recurrence.interval,
            byweekday: recurrence.byweekday ?? null,
            monthlyNth: recurrence.monthlyNth ?? null,
            monthlyWeekday: recurrence.monthlyWeekday ?? null,
            dayOfMonth: recurrence.dayOfMonth ?? null,
            startDate: recurrence.startDate,
            endDate: recurrence.endDate ?? null,
            exdates: recurrence.exdates ?? [],
          };
          writes.push(this.repo.createMany('event_recurrence', [recRow]));
        }

        if (Array.isArray(roomPlans) && roomPlans.length) {
          // PLANY SAL
          const planRows = roomPlans.map((p) => ({
            eventId,
            roomName: p.roomName,
            purpose: p.purpose ?? RoomPurpose.None,
            customTitle: p.customTitle ?? null,
            scheduleKind: p.scheduleKind ?? RoomScheduleKind.FullSpan,
            intervalHours: p.intervalHours ?? null,
            // legacy:
            hostSignup: p.hostSignup ?? null,
            // hosts @ room:
            requiresHosts: (p as any).requiresHosts ?? null,
            hostScope: (p as any).hostScope ?? null,
            // participants @ room:
            requiresParticipants: (p as any).requiresParticipants ?? null,
            participantSignup: (p as any).participantSignup ?? null,
            sessionCapacity: (p as any).sessionCapacity ?? null,
          }));
          writes.push(this.repo.createMany('event_room_plans', planRows as any));

          // SLOTY (Schedule) — łącznie z polami uczestników
          const slotsRows = roomPlans.flatMap((p) =>
            (p.slots ?? []).map((s: any) => ({
              eventId,
              roomName: p.roomName,
              startTime: this.time.hhmmss(s.startTime),
              endTime: this.time.hhmmss(s.endTime),
              purpose: s.purpose ?? null,
              customTitle: s.customTitle ?? null,

              // legacy:
              hostSignup: s.hostSignup ?? null,

              // hosts @ slot:
              requiresHosts: (s as any).requiresHosts ?? null,
              hostScope: (s as any).hostScope ?? null,

              // participants @ slot:
              requiresParticipants: (s as any).requiresParticipants ?? null,
              participantSignup: (s as any).participantSignup ?? null,
              sessionCapacity: (s as any).sessionCapacity ?? null,
            }))
          );
          if (slotsRows.length) writes.push(this.repo.createMany('event_room_slots', slotsRows as any));
        }

        const writes$ = writes.length ? forkJoin(writes).pipe(map(() => void 0)) : of(void 0);

        const fullEv: EventFull = { ...(payload as any), id: eventId, tags, rooms, recurrence, roomPlans };

        return writes$.pipe(
          switchMap(() => (coverFile ? this.uploadCover(eventId, coverFile) : of(void 0))),
          switchMap(() => {
            if (opts?.blockSlots === false) return of(void 0);
            const dates = this.computeDatesForReservations(fullEv);
            return this.reservations.ensureReservationsClient(fullEv, regenMode, dates);
          }),
          map(() => ({ id: eventId, slug: slug as string }))
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
    const { recurrence, tags, rooms, roomPlans, ...core } = patch;
    const ops: Observable<void>[] = [];

    if (Object.keys(core).length) {
      ops.push(this.repo.updateCore('new_events', id, core).pipe(map(() => void 0)));
    }

    if (Array.isArray(tags)) {
      const rows = tags.map((t) => ({ eventId: id, tag: t } as any));
      ops.push(this.repo.replaceRelations(id, [{ table: 'event_tags', whereCol: 'eventId', rows }]));
    }

    if (Array.isArray(rooms)) {
      const rows = rooms.map((r) => ({ eventId: id, roomName: r } as any));
      ops.push(this.repo.replaceRelations(id, [{ table: 'event_rooms', whereCol: 'eventId', rows }]));
    }

    if (recurrence !== undefined) {
      if (recurrence === null) {
        ops.push(
          this.repo
            .deleteWhere('event_recurrence', { eventId: { operator: FilterOperator.EQ, value: id } })
            .pipe(map(() => void 0))
        );
      } else {
        const recRow = {
          eventId: id,
          kind: recurrence.kind,
          interval: recurrence.interval,
          byweekday: recurrence.byweekday ?? null,
          monthlyNth: recurrence.monthlyNth ?? null,
          monthlyWeekday: recurrence.monthlyWeekday ?? null,
          dayOfMonth: recurrence.dayOfMonth ?? null,
          startDate: recurrence.startDate,
          endDate: recurrence.endDate ?? null,
          exdates: recurrence.exdates ?? [],
        };
        ops.push(this.repo.upsert('event_recurrence', recRow as any, 'event_id').pipe(map(() => void 0)));
      }
    }

    if (roomPlans !== undefined) {
      ops.push(
        this.repo
          .deleteWhere('event_room_slots', { eventId: { operator: FilterOperator.EQ, value: id } })
          .pipe(
            switchMap(() => this.repo.deleteWhere('event_room_plans', { eventId: { operator: FilterOperator.EQ, value: id } })),
            switchMap(() => {
              if (!Array.isArray(roomPlans) || !roomPlans.length) return of(void 0);

              const planRows = roomPlans.map((p) => ({
                eventId: id,
                roomName: p.roomName,
                purpose: p.purpose ?? RoomPurpose.None,
                customTitle: p.customTitle ?? null,
                scheduleKind: p.scheduleKind ?? RoomScheduleKind.FullSpan,
                intervalHours: p.intervalHours ?? null,
                // legacy:
                hostSignup: p.hostSignup ?? null,
                // hosts @ room:
                requiresHosts: (p as any).requiresHosts ?? null,
                hostScope: (p as any).hostScope ?? null,
                // participants @ room:
                requiresParticipants: (p as any).requiresParticipants ?? null,
                participantSignup: (p as any).participantSignup ?? null,
                sessionCapacity: (p as any).sessionCapacity ?? null,
              }));

              const slotsRows = roomPlans.flatMap((p) =>
                (p.slots ?? []).map((s) => ({
                  eventId: id,
                  roomName: p.roomName,
                  startTime: this.time.hhmmss(s.startTime),
                  endTime: this.time.hhmmss(s.endTime),
                  purpose: s.purpose ?? null,
                  customTitle: s.customTitle ?? null,

                  // legacy:
                  hostSignup: s.hostSignup ?? null,

                  // hosts @ slot:
                  requiresHosts: (s as any).requiresHosts ?? null,
                  hostScope: (s as any).hostScope ?? null,

                  // participants @ slot:
                  requiresParticipants: (s as any).requiresParticipants ?? null,
                  participantSignup: (s as any).participantSignup ?? null,
                  sessionCapacity: (s as any).sessionCapacity ?? null,
                }))
              );

              return forkJoin([
                this.repo.createMany('event_room_plans', planRows as any),
                slotsRows.length ? this.repo.createMany('event_room_slots', slotsRows as any) : of(void 0),
              ]).pipe(map(() => void 0));
            })
          )
      );
    }

    const ops$ = ops.length ? forkJoin(ops).pipe(map(() => void 0)) : of(void 0);

    return ops$.pipe(
      switchMap(() => (coverFile ? this.uploadCover(id, coverFile) : of(void 0))),
      switchMap(() => this.getById(id)),
      switchMap((full) => {
        if (!full || opts?.blockSlots === false) return of(void 0);
        const dates = this.computeDatesForReservations(full);
        return this.reservations.ensureReservationsClient(full, regenMode, dates);
      }),
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
    if (ev.recurrence) out.push(...this.rec.list(ev.recurrence, fromD, toD));
    return Array.from(new Set(out)).sort();
  }

  getHostFullness(
    ev: EventFull,
    fromIso: string,
    toIso: string
  ): Observable<Record<string, { count: number; capacity: number; isFull: boolean }>> {
    const rooms = new Set(ev.rooms ?? []);
    const hasRooms = rooms.size > 0;
    const capacity = hasRooms ? rooms.size : 1;

    return this.repo
      .getHostsRange({ eventId: { operator: FilterOperator.EQ, value: ev.id }, occurrenceDate: { operator: FilterOperator.GTE, value: fromIso } })
      .pipe(
        map((rows) => rows.filter((r: any) => r.occurrenceDate <= toIso)),
        map((rows: Array<{ occurrenceDate: string; roomName: string | null }>) => {
          const out: Record<string, { count: number; capacity: number; isFull: boolean }> = {};
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
            for (const date of dates) out[date] = { count: 1, capacity: 1, isFull: true };
          }
          return out;
        })
      );
  }

  getHostFullnessForMany(
    events: EventFull[],
    fromIso: string,
    toIso: string
  ): Observable<Record<string, Record<string, { count: number; capacity: number; isFull: boolean }>>> {
    if (!events.length) return of({});

    const evById = new Map(events.map((e) => [e.id, e]));
    const eventIds = events.map((e) => e.id);

    return this.repo
      .getHostsRange({ eventId: { operator: FilterOperator.IN, value: eventIds }, occurrenceDate: { operator: FilterOperator.GTE, value: fromIso } })
      .pipe(
        map((rows) => rows.filter((r: any) => r.occurrenceDate <= toIso)),
        map(
          (rows: Array<{ eventId: string; occurrenceDate: string; roomName: string | null }>) => {
            const out: Record<string, Record<string, { count: number; capacity: number; isFull: boolean }>> = {};
            const capacityOf = (evId: string) => {
              const ev = evById.get(evId);
              const rooms = ev?.rooms ?? [];
              return rooms.length > 0 ? rooms.length : 1;
            };
            const seenRooms = new Map<string, Map<string, Set<string>>>();
            const seenDates = new Map<string, Set<string>>();

            for (const r of rows) {
              const ev = evById.get(r.eventId);
              if (!ev) continue;
              if ((ev.rooms?.length ?? 0) > 0) {
                const allowed = new Set(ev.rooms ?? []);
                const rm = r.roomName ?? '';
                if (!allowed.has(rm)) continue;

                const byDate = seenRooms.get(r.eventId) ?? new Map<string, Set<string>>();
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
              const inner: Record<string, { count: number; capacity: number; isFull: boolean }> = {};
              if ((e.rooms?.length ?? 0) > 0) {
                const byDate = seenRooms.get(e.id) ?? new Map<string, Set<string>>();
                for (const [date, set] of byDate) inner[date] = { count: set.size, capacity: cap, isFull: set.size >= cap };
              } else {
                const dset = seenDates.get(e.id) ?? new Set<string>();
                for (const date of dset) inner[date] = { count: 1, capacity: 1, isFull: true };
              }
              out[e.id] = inner;
            }
            return out;
          }
        )
      );
  }

  getHostDataForMany(
    userId: string,
    eventIds: string[],
    fromIso: string,
    toIso: string
  ): Observable<Record<string, Record<string, true>>> {
    if (!userId || !eventIds.length) return of({});
    return this.repo
      .getHostsRange({ hostUserId: { operator: FilterOperator.EQ, value: userId }, eventId: { operator: FilterOperator.IN, value: eventIds }, occurrenceDate: { operator: FilterOperator.GTE, value: fromIso } })
      .pipe(
        map((rows) => rows.filter((r: any) => r.occurrenceDate <= toIso)),
        map((rows: Array<{ eventId: string; occurrenceDate: string }>) => {
          const out: Record<string, Record<string, true>> = {};
          for (const r of rows) (out[r.eventId] ??= {})[r.occurrenceDate] = true;
          return out;
        })
      );
  }

  private computeDatesForReservations(ev: EventFull): string[] {
    const todayIso = formatYmdLocal(new Date());
    const until = ev.singleDate ?? ev.recurrence?.endDate ?? todayIso;
    return this.listOccurrencesFE(ev, todayIso, until);
  }

  private uploadCover(eventId: string, file: File) {
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
        switchMap((fullPath) => this.repo.updateCore('new_events', eventId, { coverImagePath: fullPath })),
        map(() => void 0)
      );
  }
}
