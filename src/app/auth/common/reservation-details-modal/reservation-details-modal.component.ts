import { Component, inject, Input, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IReservation,
  ReservationStatusDisplay,
} from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { format } from 'date-fns';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-reservation-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-details-modal.component.html',
  styleUrl: './reservation-details-modal.component.scss',
})
export class ReservationDetailsModalComponent {
  private readonly auth = inject(AuthService);

  @Input() reservation!: IReservation;
  @Input() user: IUser | null = null;
  @Input() system: IRPGSystem | null = null;

  readonly activeModal = inject(NgbActiveModal);

  get userDisplayName(): string {
    return this.auth.userDisplayName(this.user);
  }

  get formattedDate(): string {
    return format(new Date(this.reservation.date), 'dd.MM.yyyy');
  }

  get displayStatus(): string {
    return ReservationStatusDisplay[this.reservation.status];
  }

  get displayName(): string {
    return this.reservation.externalName || this.userDisplayName || 'Brak danych';
  }

  get displayPhone(): string {
    return (
      this.reservation.externalPhone || this.user?.phoneNumber || 'Brak danych'
    );
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
