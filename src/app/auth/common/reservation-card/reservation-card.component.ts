import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, input, output } from '@angular/core';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { ReservationStatusDisplay } from '../../../core/interfaces/i-reservation';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent {
  private readonly auth = inject(AuthService)
  private readonly party = inject(PartyService)
  reservation = input.required<IReservation>();
  user = input<IUser | null>(null);

  showUserDetails = input(false);
  showManagePlaceholder = input(false);
  showDetailsButton = input(false);
  showCancelButton = input(false);

  partyName = ''

  manage = output<void>();
  showDetails = output<void>();
  cancel = output<void>();

ngOnInit(): void {
  const reservation = this.reservation();
  if (!reservation.teamId) return;

  this.party.getPartyById(reservation.teamId).subscribe(party => {
    this.partyName = party ? party.name : '';
  });
}

  get userDisplayName(): string | undefined {
    return this.auth.userDisplayName(this.user());
  }

  readonly statusDisplay = ReservationStatusDisplay;
}
