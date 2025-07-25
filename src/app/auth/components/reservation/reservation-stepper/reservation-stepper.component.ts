import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { RoomSelectionComponent } from '../room-selection/room-selection.component';
import { TimeSelectionComponent } from '../time-selection/time-selection.component';
import { GmSelectionComponent } from '../gm-selection/gm-selection.component';
import { ReservationSummaryComponent } from '../reservation-summary/reservation-summary.component';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

@Component({
  selector: 'app-reservation-stepper',
  standalone: true,
  imports: [
    CommonModule,
    RoomSelectionComponent,
    TimeSelectionComponent,
    GmSelectionComponent,
    ReservationSummaryComponent,
  ],
  templateUrl: './reservation-stepper.component.html',
  styleUrls: ['./reservation-stepper.component.scss'],
})
export class ReservationStepperComponent {
  readonly store = inject(ReservationStoreService);
  private readonly router = inject(Router);

  readonly step = this.store.step;

  goBack() {
    const currentStep = this.store.step();
    const previous = currentStep - 1;

    if (previous >= 0) {
      this.store.step.set(previous);
    } else {
      this.router.navigate(['/']);
    }
  }

  submitReservation() {
    console.log('Finalizing reservation:', {
      room: this.store.selectedRoom(),
      date: this.store.selectedDate(),
      startTime: this.store.selectedStartTime(),
      duration: this.store.selectedDuration(),
      needsGm: this.store.needsGm(),
      gm: this.store.selectedGm(),
      systemId: this.store.selectedSystemId?.(),
    });

    // W przyszłości: call to Supabase
  }
}
