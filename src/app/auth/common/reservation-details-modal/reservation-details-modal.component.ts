import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { format } from 'date-fns';

import { IReservation, ReservationStatusDisplay } from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { GmDirectoryService } from '../../../auth/core/services/gm/gm-directory/gm-directory.service';
import { IGmData } from '../../../core/interfaces/i-gm-profile';

@Component({
  selector: 'app-reservation-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-details-modal.component.html',
  styleUrl: './reservation-details-modal.component.scss',
})
export class ReservationDetailsModalComponent {
  private readonly auth   = inject(AuthService);
  private readonly party  = inject(PartyService);
  private readonly backend = inject(BackendService);
  private readonly gmDirectory = inject(GmDirectoryService);

  @Input() reservation!: IReservation;
  @Input() user: IUser | null = null;
  @Input() system: IRPGSystem | null = null;

  readonly activeModal = inject(NgbActiveModal);

  teamName = '';
  isBeginners: boolean | null = null;
  programStage: 1 | 2 | null = null;

  /** Dociągnięty (jeśli był wybrany) */
  gm: IGmData | null = null;

  ngOnInit(): void {
    // Drużyna / program
    const teamId = this.reservation?.teamId;
    if (teamId) {
      this.party.getPartyById(teamId).subscribe((p) => {
        this.teamName = p?.name ?? '';
        this.isBeginners = p?.beginnersProgram ?? null;
        this.programStage = p?.beginnersProgram ? (p?.programStage ?? null) : null;
      });
    }

    // System – jeśli nie został przekazany, dociągnij po systemId
    if (!this.system && this.reservation?.systemId) {
      this.backend.getById<IRPGSystem>('systems', this.reservation.systemId)
        .subscribe((sys) => (this.system = sys));
    }

    // GM – jeśli został przypisany do rezerwacji
    if (this.reservation?.gmId) {
      this.gmDirectory.getGmById(this.reservation.gmId)
        .subscribe((gm) => (this.gm = gm));
    }
  }

  get userDisplayName(): string {
    return this.auth.userDisplayName(this.user);
  }

  get gmDisplayName(): string {
    return this.gmDirectory.gmDisplayName(this.gm) || '—';
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
    return this.reservation.externalPhone || this.user?.phoneNumber || 'Brak danych';
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
