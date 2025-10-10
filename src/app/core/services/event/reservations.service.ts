import { inject, Injectable } from '@angular/core';
import { map, of, switchMap } from 'rxjs';
import { EventFull } from '../../interfaces/i-events';
import { EventRepository } from './event.repository';
import { SlotsUtil } from './slots.util';
import { formatYmdLocal } from '../../utils/weekday-options';
import { TimeUtil } from './time.util';

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly repo = inject(EventRepository);
  private readonly slots = inject(SlotsUtil);
  private readonly time = inject(TimeUtil);

  ensureReservationsClient(
    ev: EventFull,
    mode: 'APPEND_ONLY' | 'REPLACE_FUTURE' = 'REPLACE_FUTURE',
    dates: string[]
  ) {
    const todayIso = formatYmdLocal(new Date());
    const clean$ = mode === 'REPLACE_FUTURE'
      ? this.repo.cleanFutureReservations(ev.id, todayIso)
      : of(void 0);

    const rows = this.buildRows(ev, dates);
    if (!rows.length) return clean$.pipe(map(() => void 0));

    return clean$.pipe(
      switchMap(() => this.repo.ensureReservationsUpsert(rows)),
      map(() => void 0)
    );
  }

  private buildRows(ev: EventFull, dates: string[]) {
    const withPlans = Array.isArray(ev.roomPlans) && ev.roomPlans.length > 0;
    if (!dates.length) return [];

    if (withPlans) {
      const perRoom = this.slots.listRoomSlotsFE(ev);
      const rows: any[] = [];
      for (const r of perRoom) {
        for (const date of dates) {
          for (const s of r.slots) {
            rows.push({
              eventId: ev.id,
              roomName: r.roomName,
              date,
              startTime: this.time.hhmmss(s.startTime),
              durationHours: Math.max(1, Math.ceil(this.time.diffHours(s.startTime, s.endTime))),
              status: 'confirmed',
            });
          }
        }
      }
      return rows;
    }

    const start = this.time.hhmmss(ev.startTime ?? '00:00:00');
    const end = this.time.hhmmss(ev.endTime ?? '23:59:00');
    const durHours = Math.max(1, Math.ceil(this.time.diffHours(start, end)));

    return (ev.rooms ?? []).flatMap((room) =>
      dates.map((date) => ({
        eventId: ev.id,
        roomName: room,
        date,
        startTime: start,
        durationHours: durHours,
        status: 'confirmed' as const,
      }))
    );
  }
}
