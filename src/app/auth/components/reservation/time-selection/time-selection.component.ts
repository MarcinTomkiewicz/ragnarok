import { Component, computed, effect, inject, signal } from '@angular/core';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

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

  readonly selectedTime = signal<string | null>(null);
  readonly selectedDuration = signal<number>(1);
  readonly needsGm = signal(false);

  readonly reservations = signal<IReservation[]>([]);

  readonly timeSlots = computed(() => {
    const slots = Array(6).fill(true);
    const dayReservations = this.reservations();

    for (const res of dayReservations) {
      const startHour = Number(res.startTime.split(':')[0]);
      for (let i = 0; i < res.durationHours; i++) {
        const idx = startHour + i - 17;
        if (idx >= 0 && idx < 6) slots[idx] = false;
      }
    }

    return slots.map((available, i) => ({
      hour: 17 + i,
      available,
    }));
  });

  constructor() {
    effect(() => {
      const date = this.store.selectedDate();
      const room = this.store.selectedRoom();

      if (date && room) {
        this.reservationService
          .getReservationsForRoom(room, date)
          .subscribe((res) => this.reservations.set(res));
      }
    });
  }

  getDurationsFrom(hour: number): number[] {
    const taken = this.timeSlots();
    const idx = hour - 17;

    const availableDurations: number[] = [];
    for (let len = 1; len <= 6 && idx + len <= 6; len++) {
      const slice = taken.slice(idx, idx + len);
      if (slice.every((s) => s.available)) availableDurations.push(len);
      else break;
    }

    return availableDurations;
  }

  selectTime(hour: number) {
    const time = `${String(hour).padStart(2, '0')}:00`;
    this.selectedTime.set(time);
    this.selectedDuration.set(1);
  }

  get selectedHour(): number | null {
  const time = this.selectedTime();
  return time ? +time.split(':')[0] : null;
}


  isTimeAndDurationSelected(): boolean {
    return this.selectedTime() !== null && this.selectedDuration() > 0;
  }

  toggleNeedsGm() {
    this.needsGm.update((v) => !v);
  }

  confirm() {
    if (this.selectedTime()) {
      this.store.selectedStartTime.set(this.selectedTime()!);
      this.store.selectedDuration.set(this.selectedDuration());
      this.store.needsGm.set(this.needsGm());
      this.store.step.set(this.needsGm() ? 3 : 4);
    }
  }

  handleBack() {
    this.store.step.set(1);
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
  }
}
