import { CommonModule } from '@angular/common';
import { Component, EventEmitter, input, output } from '@angular/core';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { ReservationStatusDisplay } from '../../../core/interfaces/i-reservation';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent {
  reservation = input.required<IReservation>();
  user = input<IUser | null>(null);

  showUserDetails = input(false);
  showManagePlaceholder = input(false);
  showDetailsButton = input(false);
  showCancelButton = input(false);

  manage = output<void>();
  showDetails = output<void>();
  cancel = output<void>();

  readonly statusDisplay = ReservationStatusDisplay;
}
