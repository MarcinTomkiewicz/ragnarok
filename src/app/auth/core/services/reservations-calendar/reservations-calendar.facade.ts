import { Injectable, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, map, filter, switchMap, distinctUntilChanged, shareReplay } from 'rxjs';
import { ReservationService } from '../reservation/reservation.service';
import { Rooms } from '../../../../core/enums/rooms';
import { IReservation } from '../../../../core/interfaces/i-reservation';

function arrayShallowEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

@Injectable()
export class ReservationsCalendarFacade {
  private readonly reservations = inject(ReservationService);

  // „Wejścia” sterowane przez komponenty (nie w effectach):
  readonly selectedRoom = signal<Rooms | null>(null);
  readonly visibleDates = signal<string[]>([]);

  // API do ustawiania z handlerów (dalej bez effectów):
  setRoom(room: Rooms | null) { this.selectedRoom.set(room); }
  setVisibleDates(dates: string[]) { this.visibleDates.set(dates); }

  private readonly room$  = toObservable(this.selectedRoom);
  private readonly dates$ = toObservable(this.visibleDates).pipe(
    distinctUntilChanged(arrayShallowEqual)
  );

  private readonly reservationsMap$ = combineLatest([this.room$, this.dates$]).pipe(
    filter(([room, dates]) => !!room && dates.length > 0),
    switchMap(([room, dates]) =>
      forkJoin(
        dates.map(date =>
          this.reservations.getReservationsForRoom(room as Rooms, date)
            .pipe(map(res => [date, res] as const))
        )
      ).pipe(map(pairs => new Map<string, IReservation[]>(pairs)))
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Wyjście do bindowania w <app-universal-calendar [dailyDataMap]="...">
  readonly reservationsMap = toSignal(this.reservationsMap$, { initialValue: new Map<string, IReservation[]>() });
}
