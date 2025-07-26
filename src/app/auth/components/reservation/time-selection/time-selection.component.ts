import { Component, computed, inject, signal } from '@angular/core';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { Rooms } from '../../../../core/enums/rooms';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-time-selection',
  standalone: true,
  imports: [],
  templateUrl: './time-selection.component.html',
  styleUrl: './time-selection.component.scss',
})
export class TimeSelectionComponent {
  private readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);

  readonly selectedTime = signal(this.store.selectedStartTime() ?? null);
  readonly selectedDuration = signal(this.store.selectedDuration() ?? 1);
  readonly needsGm = signal(this.store.needsGm());
  readonly reservations = signal<IReservation[]>([]);

  readonly isPrivilegedUser = computed(
    () =>
      [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(
        this.auth.userCoworkerRole()!
      ) || this.auth.userSystemRole() === 'admin'
  );

  readonly isMemberRestrictedClubRoom = computed(() => {
    const room = this.store.selectedRoom();
    const role = this.auth.userCoworkerRole();

    return (
      [Rooms.Asgard, Rooms.Alfheim].includes(room) &&
      (role === CoworkerRoles.Member || this.isPrivilegedUser())
    );
  });

  readonly startHour = computed(() =>
    this.isMemberRestrictedClubRoom() ? 15 : 17
  );

  readonly endHour = computed(() => 23);

  readonly timeSlots = computed(() => {
    console.log(
      this.startHour(),
      this.endHour(),
      this.isMemberRestrictedClubRoom()
    );

    const start = this.startHour();
    const end = this.endHour();
    const slots = Array(end - start).fill(true);

    for (const res of this.reservations()) {
      const startRes = Number(res.startTime.split(':')[0]);
      for (let i = 0; i < res.durationHours; i++) {
        const idx = startRes + i - start;
        if (idx >= 0 && idx < slots.length) slots[idx] = false;
      }
    }

    return slots.map((available, i) => ({
      hour: start + i,
      available,
    }));
  });

  readonly canConfirm = computed(
    () => !!this.selectedTime() && this.selectedDuration() > 0
  );

  constructor() {
    const date = this.store.selectedDate();
    const room = this.store.selectedRoom();
    if (date && room) {
      this.reservationService
        .getReservationsForRoom(room, date)
        .subscribe((res) => this.reservations.set(res));
    }
  }

  selectTime(hour: number) {
    this.selectedTime.set(`${String(hour).padStart(2, '0')}:00`);
    this.selectedDuration.set(1);
  }

  get selectedHour(): number | null {
    const [hourStr] = this.selectedTime()?.split(':') ?? [];
    return hourStr ? parseInt(hourStr, 10) : null;
  }

  getDurationsFrom(hour: number): number[] {
    const start = this.startHour();
    const maxDur = this.isMemberRestrictedClubRoom() ? 4 : 6;
    const idx = hour - start;
    const availableDurations: number[] = [];

    for (
      let len = 1;
      len <= maxDur && idx + len <= this.timeSlots().length;
      len++
    ) {
      const slice = this.timeSlots().slice(idx, idx + len);
      if (slice.every((s) => s.available)) availableDurations.push(len);
      else break;
    }

    return availableDurations;
  }

  toggleNeedsGm() {
    this.needsGm.update((v) => !v);
  }

  confirm() {
    if (!this.canConfirm()) return;

    this.store.selectedStartTime.set(this.selectedTime()!);
    this.store.selectedDuration.set(this.selectedDuration());
    this.store.needsGm.set(this.needsGm());
    this.store.step.set(this.needsGm() ? 3 : 4);
  }

  handleBack() {
    this.store.step.set(1);
  }
}
