import { Component, computed, inject, signal } from '@angular/core';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

const START_HOUR = 17;
const END_HOUR = 23;

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

  // Lokalny stan tylko dla widoku
  readonly selectedTime = signal(this.store.selectedStartTime() ?? null);
  readonly selectedDuration = signal(this.store.selectedDuration() ?? 1);
  readonly needsGm = signal(this.store.needsGm());

  readonly reservations = signal<IReservation[]>([]);

  // Slots calculation
  readonly timeSlots = computed(() => {
    const slots = Array(END_HOUR - START_HOUR).fill(true);
    for (const res of this.reservations()) {
      const start = Number(res.startTime.split(':')[0]);
      for (let i = 0; i < res.durationHours; i++) {
        const idx = start + i - START_HOUR;
        if (idx >= 0 && idx < slots.length) slots[idx] = false;
      }
    }
    return slots.map((available, i) => ({ hour: START_HOUR + i, available }));
  });

  readonly canConfirm = computed(() =>
    !!this.selectedTime() && this.selectedDuration() > 0
  );

  // === Lifecycle ===
  constructor() {
    const date = this.store.selectedDate();
    const room = this.store.selectedRoom();
    if (date && room) {
      this.reservationService
        .getReservationsForRoom(room, date)
        .subscribe((res) => this.reservations.set(res));
    }
  }

  // === UI Logic ===
  selectTime(hour: number) {
    this.selectedTime.set(`${String(hour).padStart(2, '0')}:00`);
    this.selectedDuration.set(1); // reset
  }

  get selectedHour(): number | null {
    const [hourStr] = this.selectedTime()?.split(':') ?? [];
    return hourStr ? parseInt(hourStr, 10) : null;
  }

  getDurationsFrom(hour: number): number[] {
    const idx = hour - START_HOUR;
    const availableDurations: number[] = [];
    for (let len = 1; len <= 6 && idx + len <= 6; len++) {
      const slice = this.timeSlots().slice(idx, idx + len);
      if (slice.every((s) => s.available)) availableDurations.push(len);
      else break;
    }
    return availableDurations;
  }

  toggleNeedsGm() {
    this.needsGm.update((v) => !v);
  }

  // === Actions ===
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
