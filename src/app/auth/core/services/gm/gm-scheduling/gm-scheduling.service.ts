import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, forkJoin, from, of } from 'rxjs';
import { concatMap, find, map, switchMap } from 'rxjs/operators';
import { BackendService } from '../../../../../core/services/backend/backend.service';
import { ReservationService } from '../../reservation/reservation.service';
import { AvailabilityService } from '../../availability/availability.service';
import { GmDirectoryService } from '../gm-directory/gm-directory.service';
import { IAvailabilitySlot } from '../../../../../core/interfaces/i-availability-slot';
import { ReservationStatus } from '../../../../../core/interfaces/i-reservation';
import { IGmData } from '../../../../../core/interfaces/i-gm-profile';
import { GmSlotsMode } from '../../../../../core/enums/gm-slots-mode';

@Injectable({ providedIn: 'root' })
export class GmSchedulingService {
  private readonly backend = inject(BackendService);
  private readonly reservations = inject(ReservationService);
  private readonly availability = inject(AvailabilityService);
  private readonly directory = inject(GmDirectoryService);

  private isTimedGm = (
    slot: IAvailabilitySlot | null
  ): slot is IAvailabilitySlot & {
    workType: 'gm';
    fromHour: number;
    toHour: number;
  } =>
    !!slot &&
    slot.workType === 'gm' &&
    typeof (slot as any).fromHour === 'number' &&
    typeof (slot as any).toHour === 'number';

  getAvailability(
    gmId: string,
    dates: string[]
  ): Observable<IAvailabilitySlot[]> {
    return this.availability.getAvailability(gmId, dates, 'gm');
  }

  // ⬇️ przyjmujemy wyłącznie timed GM (kompilator dopilnuje godzin)
  upsertAvailability(
    entry: IAvailabilitySlot & {
      workType: 'gm';
      fromHour: number;
      toHour: number;
    }
  ): Observable<IAvailabilitySlot> {
    const payload: IAvailabilitySlot = {
      ...entry,
      userId: entry.userId ?? (entry as any).gmId,
      workType: 'gm' as const,
    };
    return this.availability.upsert(payload);
  }

  upsertMany(entries: IAvailabilitySlot[]): Observable<IAvailabilitySlot[]> {
    const timed = entries.filter(this.isTimedGm);
    const normalized = timed.map((e) => ({
      ...e,
      userId: e.userId ?? (e as any).gmId,
      workType: 'gm' as const,
    }));
    return this.availability.upsertMany(normalized);
  }

  deleteAvailability(gmId: string, dates: string[]): Observable<void> {
    return this.availability.delete(gmId, dates, 'gm');
  }

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
    return this.availability
      .getOneForDay(gmId, date, 'gm')
      .pipe(
        map(
          (slot) =>
            this.isTimedGm(slot) &&
            slot.fromHour <= startHour &&
            slot.toHour >= endHour
        )
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
    return this.directory.getGmsForSystem(systemId).pipe(
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
    return this.directory.getAllGms().pipe(
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
    return this.availability.getOneForDay(gmId, date, 'gm').pipe(
      switchMap((avail) => {
        if (!this.isTimedGm(avail)) return of([]);
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
              if (b.from > cursor)
                free.push({ from: cursor, to: Math.min(b.from, avail.toHour) });
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
  ) {
    if (!gmId) return of([]);
    const d = new Date(preferredDate + 'T00:00:00');
    const iso = (dt: Date) => this.isoLocal(dt);

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

    const cmp = this.byPreferredHour(preferredStartHour);

    return combineLatest(
      candidates.map((c) =>
        this.getGmFreeRanges(gmId, c.date).pipe(
          map((free) => {
            const ranked = this.chunkFreeRangesToStarts(free, duration).sort(
              cmp
            );
            const slots = ranked
              .map((h) => ({ date: c.date, startHour: h, duration }))
              .sort((a, b) => a.startHour - b.startHour);
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
    mode: GmSlotsMode,
    preferredStartHour?: number
  ) {
    const base = new Date(fromDate + 'T00:00:00');
    const iso = (dt: Date) => this.isoLocal(dt);
    const cmp = this.byPreferredHour(preferredStartHour);

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
          const starts = this.chunkFreeRangesToStarts(hit.free, duration).sort(
            cmp
          );
          return starts
            .slice(0, 8)
            .map((h) => ({ date: hit.date, startHour: h, duration }))
            .sort((a, b) => a.startHour - b.startHour);
        })
      );
    }

    let days: string[] = [];
    if (mode === GmSlotsMode.weekend) {
      const day = base.getDay();
      let deltaToNextSat = (6 - day + 7) % 7;
      if (deltaToNextSat === 0) deltaToNextSat = 7;
      const sat = new Date(base);
      sat.setDate(base.getDate() + deltaToNextSat);
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

    const MAX_PER_DAY = 4;

    return combineLatest(
      days.map((date) =>
        this.getGmFreeRanges(gmId, date).pipe(
          map((free) => {
            const starts = this.chunkFreeRangesToStarts(free, duration).sort(
              cmp
            );
            return starts
              .slice(0, MAX_PER_DAY)
              .map((h) => ({ date, startHour: h, duration }))
              .sort((a, b) => a.startHour - b.startHour);
          })
        )
      )
    ).pipe(
      map((perDay) =>
        perDay
          .flat()
          .sort(
            (a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour
          )
      )
    );
  }

  private isoLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private byPreferredHour(preferredStartHour?: number) {
    return (a: number, b: number) =>
      this.compareStarts(a, b, preferredStartHour);
  }

  private compareStarts(a: number, b: number, preferredStartHour?: number) {
    if (preferredStartHour == null) return a - b;
    const da = Math.abs(a - preferredStartHour);
    const db = Math.abs(b - preferredStartHour);
    if (da !== db) return da - db;

    // preferuj godziny po tej samej stronie co preferowana; wcześniej lub później
    const sideA = a <= preferredStartHour ? -1 : 1;
    const sideB = b <= preferredStartHour ? -1 : 1;
    if (sideA !== sideB) return sideA - sideB;

    return a - b;
  }
}
