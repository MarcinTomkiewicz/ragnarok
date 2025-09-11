import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { addMonths, format, startOfMonth } from 'date-fns';
import { forkJoin, map } from 'rxjs';
import { TimeSlots } from '../../../core/enums/hours';
import { Rooms } from '../../../core/enums/rooms';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ReservationDetailsModalComponent } from '../../common/reservation-details-modal/reservation-details-modal.component';
import { ReservationListComponent } from '../../common/reservation-list/reservation-list.component';
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { ReservationService } from '../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-upcoming-sessions',
  standalone: true,
  imports: [
    CommonModule,
    UniversalCalendarComponent,
    ReservationListComponent,
  ],
  templateUrl: './upcoming-sessions.component.html',
  styleUrl: './upcoming-sessions.component.scss',
})
export class UpcomingSessionsComponent {
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);
  readonly modal = inject(NgbModal);
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

  mapGmReservationToHours = () => (reservations: IReservation[]) => {
    const blocks = Array(TimeSlots.end - TimeSlots.noonStart).fill(false);
    for (const r of reservations) {
      if (r.gmId !== this.currentUser.id) continue;
      const hStart = parseInt(r.startTime.split(':')[0], 10);
      for (let h = hStart; h < hStart + r.durationHours; h++) {
        if (h >= TimeSlots.noonStart && h < TimeSlots.end) blocks[h - TimeSlots.noonStart] = true;
      }
    }
    return blocks;
  };

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

  readonly filteredReservationsForSelectedDate = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];

    const all = this.reservationsMap().get(date) ?? [];
    return all.filter(
      (r) => r.status === 'confirmed' || r.status === 'pending'
    );
  });

  onDateSelected(date: string) {
    this.selectedDate.set(date); // <-- poprawne
  }

  onShowDetails(reservationId: string) {
    this.reservationService
      .getReservationWithDetails(reservationId)
      .subscribe((full) => {
        const ref = this.modal.open(ReservationDetailsModalComponent, {
          size: 'md',
          backdrop: 'static',
        });

        ref.componentInstance.reservation = full;
        ref.componentInstance.user = full.user;
        ref.componentInstance.system = full.system;
      });
  }
}
