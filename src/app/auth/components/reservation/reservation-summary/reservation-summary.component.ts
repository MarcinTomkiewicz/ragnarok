import { Component, input, output } from '@angular/core';
import { Rooms } from '../../../../core/enums/rooms';

@Component({
  selector: 'app-reservation-summary',
  standalone: true,
  imports: [],
  templateUrl: './reservation-summary.component.html',
  styleUrl: './reservation-summary.component.scss',
})
export class ReservationSummaryComponent {
  readonly room = input<Rooms>();
  readonly date = input<string>();
  readonly startTime = input<string>();
  readonly duration = input<number>();
  readonly needsGm = input<boolean>();

  readonly gmId = input<string | null>(); // do backendu
  readonly gmFirstName = input<string | null>(); // do UI

  readonly confirmReservation = output<void>();
  readonly goBack = output<void>();

  confirm() {
    console.log('Rezerwacja złożona:', {
      room: this.room(),
      date: this.date(),
      startTime: this.startTime(),
      duration: this.duration(),
      needsGm: this.needsGm(),
      gmId: this.gmId(),
    });

    this.confirmReservation.emit();
  }
}
