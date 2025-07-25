import {
  Component,
  computed,
  signal,
  viewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomSelectionComponent } from '../room-selection/room-selection.component';
import { Router } from '@angular/router';
import { Rooms } from '../../../../core/enums/rooms';
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

  handleRoomSelection(room: Rooms, date: string) {
    this.store.selectedRoom.set(room);
    this.store.selectedDate.set(date);
    this.store.step.set(2);
  }

  handleTimeSelection(startTime: string, duration: number, needsGm: boolean) {
    this.store.selectedStartTime.set(startTime);
    this.store.selectedDuration.set(duration);
    this.store.needsGm.set(needsGm);

    this.store.step.set(needsGm ? 3 : 4);
  }

  handleGmSelection(gm: { id: string; firstName: string }) {
    this.store.selectedGm.set(gm.id);
    this.store.gmFirstName.set(gm.firstName);
    this.store.step.set(4);
  }

  submitReservation() {
    console.log('Finalizing reservation:', {
      room: this.store.selectedRoom(),
      date: this.store.selectedDate(),
      startTime: this.store.selectedStartTime(),
      duration: this.store.selectedDuration(),
      needsGm: this.store.needsGm(),
      gm: this.store.selectedGm(),
    });
  }

  goBack() {
    const currentStep = this.store.step();
    const previous = currentStep - 1;

    if (previous === 1) {
      this.store.selectedStartTime.set(null);
      this.store.selectedDuration.set(null);
    }

    if (previous === 0) {
      this.store.selectedRoom.set(Rooms.Midgard);
      this.store.selectedDate.set(null);
    }

    if (previous >= 0) {
      this.store.step.set(previous);
    } else {
      this.router.navigate(['/']);
    }
  }
}
