import { Injectable, signal } from '@angular/core';
import { Rooms } from '../../../../core/enums/rooms';

@Injectable({
  providedIn: 'root',
})
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

  reset() {
    this.step.set(1);
    this.selectedRoom.set(Rooms.Midgard);
    this.selectedDate.set(null);
    this.selectedStartTime.set(null);
    this.selectedDuration.set(null);
    this.needsGm.set(false);
    this.selectedGm.set(null);
    this.gmFirstName.set(null);
    this.selectedSystemId.set(null);
    this.clubConfirmationAccepted.set(false);
  }
}
