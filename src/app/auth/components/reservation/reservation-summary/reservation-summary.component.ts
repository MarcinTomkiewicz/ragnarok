import { Component, computed, inject } from '@angular/core';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

@Component({
  selector: 'app-reservation-summary',
  standalone: true,
  imports: [],
  templateUrl: './reservation-summary.component.html',
  styleUrl: './reservation-summary.component.scss',
})
export class ReservationSummaryComponent {
  readonly store = inject(ReservationStoreService);

  readonly summary = computed(() => ({
    room: this.store.selectedRoom(),
    date: this.store.selectedDate(),
    startTime: this.store.selectedStartTime(),
    duration: this.store.selectedDuration(),
    needsGm: this.store.needsGm(),
    gmId: this.store.selectedGm(),
    systemId: this.store.selectedSystemId(),
  }));

  confirm() {
    console.log('Rezerwacja:', this.summary());
    // tu docelowo call do Supabase
  }

  handleBack() {
    this.store.step.set(this.store.needsGm() ? 3 : 2);
  }
}
