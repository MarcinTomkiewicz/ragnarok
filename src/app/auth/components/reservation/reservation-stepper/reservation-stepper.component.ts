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
  readonly step = signal(1);
  readonly router = inject(Router);

  readonly selectedRoom = signal<Rooms | null>(null);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedStartTime = signal<string | null>(null);
  readonly selectedDuration = signal<number | null>(null);
  readonly needsGm = signal(false);
  readonly selectedGm = signal<string | null>(null);
  readonly gmFirstName = signal<string | null>(null);

  handleRoomSelection(room: Rooms, date: string) {
    this.selectedRoom.set(room);
    this.selectedDate.set(date);
    this.step.set(2);
  }

  handleTimeSelection(
    startTime: string,
    durationHours: number,
    needsGm: boolean
  ) {
    this.selectedStartTime.set(startTime);
    this.selectedDuration.set(durationHours);
    this.needsGm.set(needsGm);

    if (needsGm) {
      this.step.set(3);
    } else {
      this.step.set(4);
    }
  }

  handleGmSelection(gm: { id: string; firstName: string }) {
    this.selectedGm.set(gm.id);
    this.gmFirstName.set(gm.firstName);
    this.step.set(4);
  }

  submitReservation() {
    console.log('Finalizing reservation with the following details:', {
      room: this.selectedRoom(),
      date: this.selectedDate(),
      startTime: this.selectedStartTime(),
      duration: this.selectedDuration(),
      needsGm: this.needsGm(),
      gm: this.selectedGm(),
    });
  }

  goBack() {
    const previous = this.step() - 1;

    if (previous === 1) {
      this.selectedStartTime.set(null);
      this.selectedDuration.set(null);
    }

    if (previous === 0) {
      this.selectedRoom.set(null);
      this.selectedDate.set(null);
    }

    if (previous >= 0) {
      this.step.set(previous);
    } else {
      this.router.navigate(['/']);
    }
  }
}
