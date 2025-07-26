import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { ReservationCardComponent } from '../reservation-card/reservation-card.component';

@Component({
  selector: 'app-reservation-list',
  standalone: true,
  imports: [CommonModule, ReservationCardComponent],
  templateUrl: './reservation-list.component.html',
  styleUrl: './reservation-list.component.scss',
})
export class ReservationListComponent {
  reservations = input<IReservation[]>([]);
  showUserDetails = input(false);
  showManagePlaceholder = input(false);
  showDetailsButton = input(false);
  showCancelButton = input(false);

  manage = output<IReservation>();
  showDetails = output<IReservation>();
  cancel = output<IReservation>();
}
