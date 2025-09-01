import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, input, output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, of, switchMap, map } from 'rxjs';

import { IReservation } from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { ReservationStatusDisplay } from '../../../core/interfaces/i-reservation';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { TeamRole } from '../../../core/enums/team-role';
import { IParty } from '../../../core/interfaces/parties/i-party';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent implements OnInit, OnChanges {
  private readonly auth = inject(AuthService);
  private readonly party = inject(PartyService);

  reservation = input.required<IReservation>();
  user = input<IUser | null>(null);

  showUserDetails = input(false);
  showManagePlaceholder = input(false);
  showDetailsButton = input(false);
  showCancelButton = input(false);

  partyName = '';

  // ── tagi ──
  badgeBeginners = false;
  badgeMyParty = false;
  badgeClub = false;

  manage = output<void>();
  showDetails = output<void>();
  cancel = output<void>();

  private sub?: Subscription;

  ngOnInit(): void {
    this.refreshPartyData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reservation']) {
      this.refreshPartyData();
    }
  }

  private refreshPartyData() {
    this.sub?.unsubscribe();
    this.partyName = '';
    this.badgeBeginners = false;
    this.badgeMyParty = false;
    this.badgeClub = false;

    const teamId = this.reservation().teamId;
    if (!teamId) return;

    this.sub = this.party.getPartyById(teamId).pipe(
      switchMap((p: IParty | null) => {
        this.partyName = p?.name ?? '';
        this.badgeBeginners = !!p?.beginnersProgram;

        const me = this.auth.user();
        this.badgeMyParty = !!(p && me && p.gmId === me.id);

        if (!p) return of(false);

        return this.party.getPartyMembers(p.id).pipe(
          map(members => members
            .filter(m => !m.leftAt && m.role === TeamRole.Player || m.role === TeamRole.Owner)
            .map(m => m.userId)
          ),
          switchMap(playerIds => {
            if (!playerIds.length) return of(false);
            return this.party.getUsersByIds(playerIds).pipe(
              map(users => users.every(u => u.coworker === CoworkerRoles.Member))
            );
          })
        );
      })
    ).subscribe(flag => {
      this.badgeClub = flag;
    });
  }

  get userDisplayName(): string | undefined {
    return this.auth.userDisplayName(this.user());
  }

  readonly statusDisplay = ReservationStatusDisplay;
}
