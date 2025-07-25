import { Injectable, computed, signal } from '@angular/core';
import { Rooms } from '../../../../core/enums/rooms';

@Injectable({ providedIn: 'root' })
export class ReservationStoreService {
  readonly step = signal(1);
  readonly selectedRoom = signal<Rooms>(Rooms.Midgard);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedStartTime = signal<string | null>(null);
  readonly selectedDuration = signal<number | null>(null);
  readonly needsGm = signal(false);
  readonly selectedGm = signal<string | null>(null);
  readonly gmFirstName = signal<string | null>(null);
  readonly selectedSystemId = signal<string | null>(null);
  readonly clubConfirmationAccepted = signal(false);

  constructor() {
  this.setupResetGuards();
}

private setupResetGuards() {
  let prevRoom = this.selectedRoom();
  let prevDate = this.selectedDate();

  computed(() => {
    const room = this.selectedRoom();
    const date = this.selectedDate();

    if (room !== prevRoom) {
      this.selectedDate.set(null);
      this.selectedStartTime.set(null);
      this.selectedDuration.set(null);
      this.selectedGm.set(null);
      this.selectedSystemId.set(null);
      this.gmFirstName.set(null);
      this.needsGm.set(false);
      this.clubConfirmationAccepted.set(false);

      prevRoom = room;
      prevDate = null;
      return;
    }

    if (date !== prevDate) {
      this.selectedStartTime.set(null);
      this.selectedDuration.set(null);
      this.selectedGm.set(null);
      this.selectedSystemId.set(null);
      this.gmFirstName.set(null);
      this.needsGm.set(false);

      prevDate = date;
    }
  });
}

  // === Validity "guards" ===
  readonly isDateValid = computed(() =>
    !!this.selectedRoom() && !!this.selectedDate()
  );

  readonly isTimeValid = computed(() =>
    this.isDateValid() &&
    !!this.selectedStartTime() &&
    !!this.selectedDuration()
  );

  readonly isGmValid = computed(() =>
    !this.needsGm() || (!!this.selectedGm() && !!this.selectedSystemId())
  );

  readonly isReadyForSummary = computed(() =>
    this.isTimeValid() && this.isGmValid()
  );

  // === Computed snapshots (useful in templates) ===
  readonly selectedDateTime = computed(() => {
    if (!this.selectedDate() || !this.selectedStartTime()) return null;
    return `${this.selectedDate()} ${this.selectedStartTime()}`;
  });

  // === Step validation (optional) ===
  readonly isStepValid = computed(() => {
    switch (this.step()) {
      case 1: return !!this.selectedRoom() && !!this.selectedDate();
      case 2: return this.isTimeValid();
      case 3: return this.isGmValid();
      case 4: return this.isReadyForSummary();
      default: return false;
    }
  });
}
