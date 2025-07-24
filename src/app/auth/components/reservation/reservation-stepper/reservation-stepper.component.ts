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

@Component({
  selector: 'app-reservation-stepper',
  standalone: true,
  imports: [CommonModule, RoomSelectionComponent],
  templateUrl: './reservation-stepper.component.html',
})
export class ReservationStepperComponent {
  readonly router = inject(Router);

  readonly step = signal(1);

  readonly selectedRoom = signal<Rooms | null>(null);
  readonly selectedDate = signal<string | null>(null);

  readonly roomSelection = viewChild(RoomSelectionComponent);

  readonly canProceed = computed(() => {
    return !!this.selectedRoom() && !!this.selectedDate();
  });

  onRoomSelected(selection: { room: Rooms; date: string }) {
    this.selectedRoom.set(selection.room);
    this.selectedDate.set(selection.date);
    this.step.set(2);
    // tutaj za chwilę pokażemy kolejną sekcję np. godziny
  }

  goBack() {
    this.step.set(1);
  }

  goToSummary() {
    // Do późniejszej implementacji
  }
}
