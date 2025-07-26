import { Component, computed, inject, signal } from '@angular/core';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { Rooms } from '../../../../core/enums/rooms';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { SystemRole } from '../../../../core/enums/systemRole';

enum TimeSlots {
  earlyStart = 15,
  lateStart = 17,
  end = 23,
}

enum DurationOptions {
  ClubRoom = 4,
  OtherRoom = 6,
}

@Component({
  selector: 'app-time-selection',
  standalone: true,
  imports: [],
  templateUrl: './time-selection.component.html',
  styleUrl: './time-selection.component.scss',
})
export class TimeSelectionComponent {
  // === Dependencies ===
  private readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);

  // === Local state ===
  readonly selectedTime = signal<string | null>(this.store.selectedStartTime() ?? null);
  readonly selectedDuration = signal<number>(this.store.selectedDuration() ?? 1);
  readonly needsGm = signal<boolean>(this.store.needsGm());
  readonly reservations = signal<IReservation[]>([]);

  // === Roles ===
  readonly isPrivilegedUser = computed(() =>
    [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(
      this.auth.userCoworkerRole()!
    ) || this.auth.userSystemRole() === SystemRole.Admin
  );

  readonly isMemberRestrictedClubRoom = computed(() => {
    const room = this.store.selectedRoom();
    const role = this.auth.userCoworkerRole();

    return (
      [Rooms.Asgard, Rooms.Alfheim].includes(room) &&
      (role === CoworkerRoles.Member || this.isPrivilegedUser())
    );
  });

  // === Time logic ===
  readonly startHour = computed(() =>
    this.isMemberRestrictedClubRoom() ? TimeSlots.earlyStart : TimeSlots.lateStart
  );

  readonly endHour = computed(() => TimeSlots.end);

  readonly timeSlots = computed(() => {
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

  readonly selectedHour = computed(() => {
    const [hourStr] = this.selectedTime()?.split(':') ?? [];
    return hourStr ? parseInt(hourStr, 10) : null;
  });

  readonly durations = computed(() => {
    const hour = this.selectedHour();
    if (hour === null) return [];

    const start = this.startHour();
    const maxDur = this.isMemberRestrictedClubRoom() ? DurationOptions.ClubRoom : DurationOptions.OtherRoom;
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
  });

  // === Sync with store when user acts ===
  selectTime(hour: number) {
    const time = `${String(hour).padStart(2, '0')}:00`;
    this.selectedTime.set(time);
    this.selectedDuration.set(1);

    this.store.selectedStartTime.set(time);
    this.store.selectedDuration.set(1);
  }

  selectDuration(duration: number) {
    this.selectedDuration.set(duration);
    this.store.selectedDuration.set(duration);
  }

  toggleNeedsGm() {
    const updated = !this.needsGm();
    this.needsGm.set(updated);
    this.store.needsGm.set(updated);
  }

  // === Used by stepper ===
  readonly canProceed = computed(() =>
    !!this.store.selectedStartTime() && this.store.selectedDuration()
  );

  // === Init data ===
  constructor() {
    const date = this.store.selectedDate();
    const room = this.store.selectedRoom();

    if (date && room) {
      this.reservationService
        .getReservationsForRoom(room, date)
        .subscribe((res) => this.reservations.set(res));
    }
  }
}
