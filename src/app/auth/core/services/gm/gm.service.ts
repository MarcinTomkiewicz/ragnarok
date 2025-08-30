import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, combineLatest, from } from 'rxjs';
import { map, switchMap, concatMap, find } from 'rxjs/operators';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import {
  IAvailabilitySlot,
  IGmData,
} from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { toSnakeCase } from '../../../../core/utils/type-mappers';
import { ReservationService } from '../reservation/reservation.service';
import { ReservationStatus } from '../../../../core/interfaces/i-reservation';
import { GmSlotsMode } from '../../../../core/enums/gm-slots-mode';
import { IUser } from '../../../../core/interfaces/i-user';

@Injectable({ providedIn: 'root' })
export class GmService {
  private readonly backend = inject(BackendService);
  private readonly reservations = inject(ReservationService);

  // ======== BASIC QUERIES ========

  getAllGms(): Observable<IGmData[]> {
    return this.backend.getAll<IGmData>('v_gm_basic_info');
  }

  /**
   * Pełne info GM (z widoku v_gm_basic_info – rekordy per system).
   * Fallback do `users` -> minimalne IGmData, żeby UI nie wybuchał.
   */
  getGmById(gmId: string | null): Observable<IGmData | null> {
    if (!gmId) return of(null);

    return this.backend
      .getAll<IGmData>('v_gm_basic_info', undefined, 'asc', {
        filters: { userId: { value: gmId, operator: FilterOperator.EQ } },
      })
      .pipe(
        map((rows) => rows?.[0] ?? null),
        switchMap((row) => {
          if (row) return of(this.fillGmDefaults(row));
          // fallback: minimal z tabeli users
          return this.backend
            .getById<IUser>('users', gmId)
            .pipe(map((u) => (u ? this.fromUserToMinimalGm(u) : null)));
        })
      );
  }

  /**
   * Systemy prowadzone przez GM (po userId).
   * Czyta z v_gm_specialties_with_user, zwraca pełne rekordy systems.
   */
  getSystemsForGm(gmId: string): Observable<IRPGSystem[]> {
    return this.backend
      .getAll<Pick<IGmData, 'systemId'>>(
        'v_gm_specialties_with_user',
        undefined,
        'asc',
        {
          filters: { userId: { value: gmId, operator: FilterOperator.EQ } },
        }
      )
      .pipe(
        map((rows) =>
          Array.from(new Set(rows.map((r) => r.systemId))).filter(Boolean)
        ),
        switchMap((ids) =>
          ids.length
            ? this.backend.getByIds<IRPGSystem>('systems', ids)
            : of([])
        )
      );
  }

  getGmsForSystem(systemId: string): Observable<IGmData[]> {
    return this.backend.getAll<IGmData>(
      'v_gm_specialties_with_user',
      undefined,
      'asc',
      {
        filters: { systemId: { value: systemId, operator: FilterOperator.EQ } },
      }
    );
  }

  // ======== AVAILABILITY CRUD ========

  getAvailability(
    gmId: string,
    dates: string[]
  ): Observable<IAvailabilitySlot[]> {
    if (!dates.length) return of([]);
    return this.backend.getAll<IAvailabilitySlot>(
      'gm_availability',
      undefined,
      'asc',
      {
        filters: {
          gmId: { value: gmId, operator: FilterOperator.EQ },
          date: { value: dates, operator: FilterOperator.IN },
        },
      }
    );
  }

  upsertAvailability(entry: IAvailabilitySlot): Observable<IAvailabilitySlot> {
    return this.backend.upsert<IAvailabilitySlot>(
      'gm_availability',
      toSnakeCase(entry),
      'gm_id,date'
    );
  }

  updateSpecialties(gmId: string, systemIds: string[]): Observable<void> {
    const table = 'gm_specialties';

    const delete$ = this.backend.delete(table, {
      gm_id: { value: gmId, operator: FilterOperator.EQ },
    });

    const insertPayload = systemIds.map((systemId) =>
      toSnakeCase({ gmId, systemId })
    );
    const insert$ = systemIds.length
      ? this.backend.createMany(table, insertPayload)
      : of([]);

    return delete$.pipe(
      switchMap(() => insert$),
      map(() => {})
    );
  }

  upsertMany(entries: IAvailabilitySlot[]): Observable<IAvailabilitySlot[]> {
    if (!entries.length) return of([]);
    const withId = entries.filter((e) => !!e.id);
    const withoutId = entries.filter((e) => !e.id);

    const reqs: Observable<IAvailabilitySlot[]>[] = [];

    if (withId.length) {
      const payload = withId.map((e) => toSnakeCase(e));
      reqs.push(
        this.backend.upsertMany<IAvailabilitySlot>(
          'gm_availability',
          toSnakeCase(payload),
          'id'
        )
      );
    }

    if (withoutId.length) {
      const payload = withoutId.map(({ id, ...rest }) => toSnakeCase(rest));
      reqs.push(
        this.backend.upsertMany<IAvailabilitySlot>(
          'gm_availability',
          toSnakeCase(payload),
          'gm_id,date'
        )
      );
    }

    return reqs.length === 1
      ? reqs[0]
      : combineLatest(reqs).pipe(map((r) => r.flat()));
  }

  deleteAvailability(gmId: string, dates: string[]): Observable<void> {
    if (!dates.length) return of();
    return this.backend.delete('gm_availability', {
      gm_id: { value: gmId, operator: FilterOperator.EQ },
      date: { value: dates, operator: FilterOperator.IN },
    });
  }

  // ======== DISPLAY HELPERS ========

  readonly gmDisplayName = (gm: IGmData | null): string => {
    if (!gm) return '';
    return gm.useNickname && gm.nickname ? gm.nickname : gm.firstName ?? '';
  };

  private fillGmDefaults(g: IGmData): IGmData {
    return {
      gmProfileId: g.gmProfileId ?? '',
      userId: g.userId,
      firstName: g.firstName ?? '',
      nickname: g.nickname ?? '',
      age: g.age ?? null,
      shortDescription: g.shortDescription ?? null,
      experience: g.experience ?? null,
      image: g.image ?? null,
      quote: g.quote ?? null,
      styleTags: g.styleTags ?? [],
      systemId: g.systemId ?? '',
      gmProfileCreatedAt: g.gmProfileCreatedAt ?? new Date(0),
      useNickname: !!g.useNickname,
    };
  }

  private fromUserToMinimalGm(u: IUser): IGmData {
    return {
      gmProfileId: '',
      userId: u.id,
      firstName: u.firstName ?? '',
      nickname: u.nickname ?? '',
      age: null,
      shortDescription: null,
      experience: null,
      image: null,
      quote: null,
      styleTags: [],
      systemId: '',
      gmProfileCreatedAt: new Date(0),
      useNickname: !!u.useNickname,
    };
  }

  // ======== AVAILABILITY / SLOTS LOGIC ========

  private isTimeOverlapping(
    startA: number,
    durationA: number,
    startB: number,
    durationB: number
  ): boolean {
    const endA = startA + durationA;
    const endB = startB + durationB;
    return startA < endB && endA > startB;
  }

  private isAvailableDuringTimeRange(
    gmId: string,
    date: string,
    startHour: number,
    duration: number
  ): Observable<boolean> {
    const endHour = startHour + duration;
    return this.backend
      .getOneByFields<{ fromHour: number; toHour: number }>('gm_availability', {
        gmId,
        date,
      })
      .pipe(
        map((availability) => {
          if (!availability) return false;
          return (
            availability.fromHour <= startHour && availability.toHour >= endHour
          );
        })
      );
  }

  private isGmBusyAtSlot(
    gmId: string,
    date: string,
    startHour: number,
    duration: number
  ): Observable<boolean> {
    return this.reservations.getReservationsForGm(gmId, date).pipe(
      map((reservations) =>
        reservations
          .filter(
            (r) =>
              r.status === ReservationStatus.Confirmed ||
              r.status === ReservationStatus.Pending
          )
          .some((res) => {
            const existingStart = parseInt(res.startTime.split(':')[0], 10);
            return this.isTimeOverlapping(
              startHour,
              duration,
              existingStart,
              res.durationHours
            );
          })
      )
    );
  }

  getAvailableGmsForSystem(
    systemId: string,
    date: string,
    startHour: number,
    duration: number
  ): Observable<IGmData[]> {
    return this.getGmsForSystem(systemId).pipe(
      switchMap((gms) => {
        if (!gms.length) return of([]);
        return forkJoin(
          gms.map((gm) =>
            forkJoin([
              this.isGmBusyAtSlot(gm.userId, date, startHour, duration),
              this.isAvailableDuringTimeRange(
                gm.userId,
                date,
                startHour,
                duration
              ),
            ]).pipe(map(([busy, avail]) => (!busy && avail ? gm : null)))
          )
        ).pipe(map((arr) => arr.filter((x): x is IGmData => !!x)));
      })
    );
  }

  getAllGmsForTimeRange(
    date: string,
    startHour: number,
    duration: number
  ): Observable<IGmData[]> {
    return this.getAllGms().pipe(
      switchMap((gms) => {
        if (!gms.length) return of([]);
        return forkJoin(
          gms.map((gm) =>
            forkJoin([
              this.isGmBusyAtSlot(gm.userId, date, startHour, duration),
              this.isAvailableDuringTimeRange(
                gm.userId,
                date,
                startHour,
                duration
              ),
            ]).pipe(map(([busy, avail]) => (!busy && avail ? gm : null)))
          )
        ).pipe(map((arr) => arr.filter((x): x is IGmData => !!x)));
      })
    );
  }

  getGmFreeRanges(
    gmId: string,
    date: string
  ): Observable<{ from: number; to: number }[]> {
    return this.backend
      .getOneByFields<{ fromHour: number; toHour: number }>('gm_availability', {
        gmId,
        date,
      })
      .pipe(
        switchMap((avail) => {
          if (!avail) return of([] as { from: number; to: number }[]);
          return this.reservations.getReservationsForGm(gmId, date).pipe(
            map((reservations) => {
              const busy = reservations
                .filter(
                  (r) =>
                    r.status === ReservationStatus.Confirmed ||
                    r.status === ReservationStatus.Pending
                )
                .map((r) => {
                  const s = parseInt(r.startTime.split(':')[0], 10);
                  return { from: s, to: s + r.durationHours };
                })
                .sort((a, b) => a.from - b.from);

              const free: { from: number; to: number }[] = [];
              let cursor = avail.fromHour;

              for (const b of busy) {
                if (b.from > cursor) {
                  free.push({
                    from: cursor,
                    to: Math.min(b.from, avail.toHour),
                  });
                }
                cursor = Math.max(cursor, b.to);
                if (cursor >= avail.toHour) break;
              }
              if (cursor < avail.toHour)
                free.push({ from: cursor, to: avail.toHour });

              const OPEN = 17,
                CLOSE = 23;
              return free
                .map((r) => ({
                  from: Math.max(r.from, OPEN),
                  to: Math.min(r.to, CLOSE),
                }))
                .filter((r) => r.to > r.from);
            })
          );
        })
      );
  }

  private chunkFreeRangesToStarts(
    ranges: { from: number; to: number }[],
    duration: number
  ): number[] {
    const starts: number[] = [];
    for (const r of ranges) {
      for (let h = r.from; h + duration <= r.to; h++) starts.push(h);
    }
    return starts;
  }

  suggestSlotsAround(
    preferredDate: string,
    preferredStartHour: number,
    duration: number,
    gmId: string | null,
    allowPrevDay: boolean
  ): Observable<
    {
      label: string;
      slots: { date: string; startHour: number; duration: number }[];
    }[]
  > {
    if (!gmId) return of([]);
    const d = new Date(preferredDate + 'T00:00:00');
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);
    const d0 = new Date(d);
    const dM1 = new Date(d);
    dM1.setDate(d.getDate() - 1);
    const dP1 = new Date(d);
    dP1.setDate(d.getDate() + 1);

    const candidates: { label: string; date: string }[] = [];
    if (allowPrevDay)
      candidates.push({ label: 'Dzień wcześniej', date: iso(dM1) });
    candidates.push({ label: 'Wybrany dzień', date: iso(d0) });
    candidates.push({ label: 'Dzień później', date: iso(dP1) });

    return combineLatest(
      candidates.map((c) =>
        this.getGmFreeRanges(gmId, c.date).pipe(
          map((free) => {
            const starts = this.chunkFreeRangesToStarts(free, duration).sort(
              (a, b) =>
                Math.abs(a - preferredStartHour) -
                Math.abs(b - preferredStartHour)
            );
            const slots = starts.map((h) => ({
              date: c.date,
              startHour: h,
              duration,
            }));
            return { label: c.label, slots };
          })
        )
      )
    ).pipe(map((groups) => groups.filter((g) => g.slots.length > 0)));
  }

  moreSlots(
    gmId: string,
    fromDate: string,
    duration: number,
    mode: GmSlotsMode
  ): Observable<{ date: string; startHour: number; duration: number }[]> {
    const base = new Date(fromDate + 'T00:00:00');
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);

    if (mode === GmSlotsMode.next) {
      type Range = { from: number; to: number };
      type Hit = { date: string; free: Range[] };

      const HORIZON_DAYS = 60;
      const days: string[] = [];
      for (let i = 1; i <= HORIZON_DAYS; i++) {
        const t = new Date(base);
        t.setDate(base.getDate() + i);
        days.push(iso(t));
      }

      return from(days).pipe(
        concatMap((date) =>
          this.getGmFreeRanges(gmId, date).pipe(
            map<Range[], Hit>((free) => ({ date, free }))
          )
        ),
        find((hit) => hit.free.length > 0),
        map((hit) => {
          if (!hit) return [];
          const starts = this.chunkFreeRangesToStarts(hit.free, duration);
          return starts
            .map((h) => ({ date: hit.date, startHour: h, duration }))
            .slice(0, 8);
        })
      );
    }

    let days: string[] = [];
    if (mode === GmSlotsMode.weekend) {
      const day = base.getDay();
      const sat = new Date(base);
      sat.setDate(base.getDate() + ((6 - (day || 7)) % 7));
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);
      days = [iso(sat), iso(sun)];
    } else {
      const jump =
        mode === GmSlotsMode.twoDays
          ? 2
          : mode === GmSlotsMode.threeDays
          ? 3
          : 7;
      for (let i = 1; i <= jump; i++) {
        const t = new Date(base);
        t.setDate(base.getDate() + i);
        days.push(iso(t));
      }
    }

    return combineLatest(
      days.map((date) =>
        this.getGmFreeRanges(gmId, date).pipe(
          map((free) =>
            this.chunkFreeRangesToStarts(free, duration).map((h) => ({
              date,
              startHour: h,
              duration,
            }))
          )
        )
      )
    ).pipe(map((arr) => arr.flat().slice(0, 8)));
  }
}
