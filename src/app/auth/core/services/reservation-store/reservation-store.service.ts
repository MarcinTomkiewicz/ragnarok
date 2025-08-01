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
  readonly confirmedTeam = signal(false);
  readonly isReceptionMode = signal(false);
  readonly externalName = signal<string | null>(null);
  readonly externalPhone = signal<string | null>(null);
  readonly externalIsClubMember = signal<boolean | null>(null);

  readonly isExternalInfoValid = computed(() => {
    const phone = this.externalPhone();
    return (
      this.externalName() !== null &&
      phone !== null &&
      phone.length === 9
    );
  });

  // === Validity "guards" ===
  readonly isDateValid = computed(
    () => !!this.selectedRoom() && !!this.selectedDate()
  );

  readonly isTimeValid = computed(
    () =>
      this.isDateValid() &&
      !!this.selectedStartTime() &&
      !!this.selectedDuration()
  );

  readonly isGmValid = computed(
    () => !this.needsGm() || (!!this.selectedGm() && !!this.selectedSystemId())
  );

  readonly isReadyForSummary = computed(
    () => this.isTimeValid() && this.isGmValid()
  );
}
