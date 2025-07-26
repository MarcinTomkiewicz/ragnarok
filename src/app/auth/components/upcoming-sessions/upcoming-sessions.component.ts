import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { format, addMonths, startOfMonth } from 'date-fns';
import { forkJoin, map } from 'rxjs';
import { Rooms } from '../../../core/enums/rooms';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ReservationCalendarComponent } from '../../common/reservation-calendar/reservation-calendar.component';

@Component({
  selector: 'app-upcoming-sessions',
  standalone: true,
  imports: [CommonModule, ReservationCalendarComponent],
  templateUrl: './upcoming-sessions.component.html',
  styleUrl: './upcoming-sessions.component.scss',
})
export class UpcomingSessionsComponent {
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);
  readonly Rooms = Rooms;

  readonly currentUser = this.auth.user()!;
  readonly currentMonth = signal(new Date());

  readonly reservationsMap = signal(new Map<string, IReservation[]>());

  readonly selectedDate = signal<string | null>(null);

  readonly visibleDates = computed(() => {
    const dates: string[] = [];
    const today = startOfMonth(new Date());
    const end = startOfMonth(addMonths(today, 1));
    let iter = new Date(today);

    while (iter <= end) {
      dates.push(format(iter, 'yyyy-MM-dd'));
      iter.setDate(iter.getDate() + 1);
    }

    return dates;
  });

  constructor() {
    effect(() => {
      this.fetchReservations();
    });
  }

  fetchReservations() {
    const dates = this.visibleDates();
    forkJoin(
      dates.map((date) =>
        this.reservationService
          .getReservationsForGm(this.currentUser.id!, date)
          .pipe(map((res) => [date, res] as const))
      )
    ).subscribe((pairs) => {
      this.reservationsMap.set(new Map(pairs));
    });
  }

  onMonthChanged(dates: string[]) {
  forkJoin(
    dates.map((date) =>
      this.reservationService
        .getReservationsForGm(this.currentUser.id!, date)
        .pipe(map((res) => [date, res] as const))
    )
  ).subscribe((pairs) => {
    this.reservationsMap.set(new Map(pairs));
  });
}



  onDateSelected(date: string) {
    this.selectedDate.set(date);
    // TODO: później możemy tu np. otwierać modal z listą rezerwacji
  }
}
