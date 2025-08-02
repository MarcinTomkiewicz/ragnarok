import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { forkJoin, map } from 'rxjs';
import { Rooms, SortedRooms } from '../../../core/enums/rooms';
import { TimeSlots } from '../../../core/enums/hours';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ReservationDetailsModalComponent } from '../../common/reservation-details-modal/reservation-details-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ReservationListComponent } from '../../common/reservation-list/reservation-list.component';
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { ReservationStoreService } from '../../core/services/reservation-store/reservation-store.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';

@Component({
  selector: 'app-room-reservation-overview',
  standalone: true,
  imports: [
    CommonModule,
    UniversalCalendarComponent,
    ReservationListComponent,
  ],
  templateUrl: './room-reservation-overview.component.html',
})
export class RoomReservationsOverviewComponent {
  private readonly reservationService = inject(ReservationService);
  private readonly modal = inject(NgbModal);
  private readonly auth = inject(AuthService);

  readonly SortedRooms = SortedRooms;

  readonly selectedRoom = signal<Rooms>(Rooms.Midgard);
  readonly selectedDate = signal<string | null>(null);
  readonly reservationsMap = signal(new Map<string, IReservation[]>());

  readonly visibleDates = computed(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
  });

  constructor() {
    effect(() => {
      this.fetchReservations();
    });
  }

  fetchReservations() {
    const room = this.selectedRoom();
    const dates = this.visibleDates();

    forkJoin(
      dates.map((date) =>
        this.reservationService
          .getReservationsForRoom(room, date)
          .pipe(map((res) => [date, res] as const))
      )
    ).subscribe((pairs) => {
      this.reservationsMap.set(new Map(pairs));
    });
  }

  onMonthChanged(dates: string[]) {
    const room = this.selectedRoom();
    forkJoin(
      dates.map((date) =>
        this.reservationService
          .getReservationsForRoom(room, date)
          .pipe(map((res) => [date, res] as const))
      )
    ).subscribe((pairs) => {
      this.reservationsMap.set(new Map(pairs));
    });
  }

  readonly filteredReservationsForSelectedDate = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.reservationsMap().get(date) ?? [];
  });

  onSelectRoom(room: Rooms) {
    this.selectedRoom.set(room);
    this.selectedDate.set(null);
    this.fetchReservations();
  }

  onDateSelected(date: string) {
    this.selectedDate.set(date);
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

  mapReservationToHours = () => (reservations: IReservation[]) => {
    const blocks = Array(TimeSlots.end - TimeSlots.noonStart).fill(false);
    for (const r of reservations) {
      const hStart = parseInt(r.startTime.split(':')[0], 10);
      for (let h = hStart; h < hStart + r.durationHours; h++) {
        if (h >= TimeSlots.noonStart && h < TimeSlots.end) {
          blocks[h - TimeSlots.noonStart] = true;
        }
      }
    }
    return blocks;
  };

  readonly isPrivilegedUser = computed(() =>
    [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(this.auth.userCoworkerRole()!) ||
    this.auth.userSystemRole() === SystemRole.Admin
  );
}
