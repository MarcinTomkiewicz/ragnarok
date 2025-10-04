import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Rooms, SortedRooms } from '../../../core/enums/rooms';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SystemRole } from '../../../core/enums/systemRole';
import { CoworkerRoles } from '../../../core/enums/roles';
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { ReservationListComponent } from '../../common/reservation-list/reservation-list.component';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { ReservationDetailsModalComponent } from '../../common/reservation-details-modal/reservation-details-modal.component';
import { ReservationsCalendarFacade } from '../../core/services/reservations-calendar/reservations-calendar.facade';
import { toCamelCase } from '../../../core/utils/type-mappers';

@Component({
  selector: 'app-room-reservation-overview',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent, ReservationListComponent],
  templateUrl: './room-reservation-overview.component.html',
  providers: [ReservationsCalendarFacade],
})
export class RoomReservationsOverviewComponent {
  private readonly modal = inject(NgbModal);
  private readonly auth = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  readonly calendar = inject(ReservationsCalendarFacade);

  readonly SortedRooms = SortedRooms;
  readonly selectedRoom = signal<Rooms>(Rooms.Midgard);
  readonly selectedDate = signal<string | null>(null);

  constructor() {
    // Ustaw initial room (nie w effect())
    this.calendar.setRoom(this.selectedRoom());
  }

  // ===== Handlery =====
  onMonthChanged(dates: string[]) {
    this.calendar.setVisibleDates(dates);
  }

  onSelectRoom(room: Rooms) {
    if (this.selectedRoom() === room) return;
    this.selectedRoom.set(room);
    this.selectedDate.set(null);
    this.calendar.setRoom(room); // kluczowe
  }

  onDateSelected(date: string) {
    this.selectedDate.set(date);
  }

  readonly filteredReservationsForSelectedDate = computed(() => {
    const date = this.selectedDate();
    const raw = date ? (this.calendar.reservationsMap().get(date) ?? []) : [];
    
    return raw;
  });

  onShowDetails(reservationId: string) {
    this.reservationService.getReservationWithDetails(reservationId)
      .subscribe(full => {
        const ref = this.modal.open(ReservationDetailsModalComponent, { size: 'lg', backdrop: 'static' });
        ref.componentInstance.reservation = full;
        ref.componentInstance.user = full.user;
        ref.componentInstance.system = full.system;
      });
  }

  mapReservationToHours = () => (reservations: IReservation[]) => {
    const blocks = Array(23 - 12).fill(false);
    for (const r of reservations) {
      const hStart = parseInt(r.startTime.split(':')[0], 10);
      for (let h = hStart; h < hStart + r.durationHours; h++) {
        if (h >= 12 && h < 23) blocks[h - 12] = true;
      }
    }
    return blocks;
  };

  readonly isPrivilegedUser = computed(
    () =>
      [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(this.auth.userCoworkerRole()!)
      || this.auth.userSystemRole() === SystemRole.Admin
  );
}
