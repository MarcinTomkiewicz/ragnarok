import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { format } from 'date-fns';

import {
  IReservation,
  ReservationStatusDisplay,
} from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IGmExtraInfoRow } from '../../../core/interfaces/i-gm-extra-info';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { GmDirectoryService } from '../../../auth/core/services/gm/gm-directory/gm-directory.service';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { FilterOperator } from '../../../core/enums/filterOperator';

@Component({
  selector: 'app-reservation-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-details-modal.component.html',
  styleUrl: './reservation-details-modal.component.scss',
})
export class ReservationDetailsModalComponent {
  private readonly auth = inject(AuthService);
  private readonly party = inject(PartyService);
  private readonly backend = inject(BackendService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly reservations = inject(ReservationService);

  @Input() reservation!: IReservation;
  @Input() user: IUser | null = null;
  @Input() system: IRPGSystem | null = null;

  readonly activeModal = inject(NgbActiveModal);

  // Drużyna / program
  teamName = '';
  isBeginners: boolean | null = null;
  programStage: 1 | 2 | null = null;

  // GM
  gm: IGmData | null = null;

  hasExtraInfo = false;
  showExtra = false;
  loadingExtra = false;
  extraInfo: IGmExtraInfoRow | null = null;

  guidelinesParas: string[] = [];
  extraNotesParas: string[] = [];

  ngOnInit(): void {
    const teamId = this.reservation?.teamId;
    if (teamId) {
      this.party.getPartyById(teamId).subscribe((p) => {
        this.teamName = p?.name ?? '';
        this.isBeginners = p?.beginnersProgram ?? null;
        this.programStage = p?.beginnersProgram
          ? p?.programStage ?? null
          : null;
      });
    }

    if (!this.system && this.reservation?.systemId) {
      this.backend
        .getById<IRPGSystem>('systems', this.reservation.systemId)
        .subscribe((sys) => (this.system = sys));
    }

    if (this.reservation?.gmId) {
      this.gmDirectory
        .getGmById(this.reservation.gmId)
        .subscribe((gm) => (this.gm = gm));
    }

    this.backend
      .getCount('reservation_gm_extra_info', {
        reservation_id: {
          operator: FilterOperator.EQ,
          value: this.reservation.id,
        },
      })
      .subscribe((count) => {
        this.hasExtraInfo = count > 0;
      });
  }

  private splitToParas(s?: string | null): string[] {
    return (s ?? '')
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  // --- UI helpers ---

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
    return (
      this.reservation.externalName || this.userDisplayName || 'Brak danych'
    );
  }

  get displayPhone(): string {
    return (
      this.reservation.externalPhone || this.user?.phoneNumber || 'Brak danych'
    );
  }

  // --- Extra info loading/toggle ---

  toggleExtra(): void {
    if (this.showExtra) {
      this.showExtra = false;
      return;
    }
    if (!this.extraInfo) {
      this.loadingExtra = true;
      this.reservations
        .getGmExtraInfoByReservationId(this.reservation.id)
        .subscribe({
          next: (row) => {
            this.extraInfo = row;
            this.guidelinesParas = this.splitToParas(row?.characterGuidelines);
            this.extraNotesParas = this.splitToParas(row?.extraNotes);

            this.loadingExtra = false;
            this.showExtra = !!row;
          },
          error: () => {
            this.loadingExtra = false;
            this.showExtra = false;
          },
        });
    } else {
      this.showExtra = true;
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
