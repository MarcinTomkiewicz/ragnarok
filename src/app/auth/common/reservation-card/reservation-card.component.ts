import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
  input,
  output,
} from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, of, switchMap, map } from 'rxjs';

import { IReservation, ReservationStatusDisplay } from '../../../core/interfaces/i-reservation';
import { IUser } from '../../../core/interfaces/i-user';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IGmData } from '../../../core/interfaces/i-gm-profile';

import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { GmDirectoryService } from '../../../auth/core/services/gm/gm-directory/gm-directory.service';

import { CoworkerRoles } from '../../../core/enums/roles';
import { TeamRole } from '../../../core/enums/party.enum';
import { IParty } from '../../../core/interfaces/parties/i-party';
import { UserCacheService } from '../../core/services/user-cache/user-cache.service';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './reservation-card.component.html',
  styleUrl: './reservation-card.component.scss',
})
export class ReservationCardComponent implements OnInit, OnChanges, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly party = inject(PartyService);
  private readonly backend = inject(BackendService);
  private readonly users = inject(UserCacheService);
  private readonly gmDirectory = inject(GmDirectoryService);

  // Inputs (API jak wcześniej)
  reservation = input.required<IReservation>();
  user = input<IUser | null>(null);         // jeśli parent poda – użyjemy
  showUserDetails = input<boolean>(false);  // legacy/no-op: zostawiamy dla kompatybilności
  showManagePlaceholder = input(false);
  showDetailsButton = input(false);
  showCancelButton = input(false);

  // Outputs (bez zmian)
  manage = output<void>();
  showDetails = output<void>();
  cancel = output<void>();

  // UI state
  partyName = '';
  badgeBeginners = false;
  badgeMyParty = false;
  badgeClub = false;

  // Lookups
  systemName: string | null = null;
  gm: IGmData | null = null;
  private localUser: IUser | null = null;

  private subParty?: Subscription;
  private subLookups?: Subscription;
  private subUser?: Subscription;

  ngOnInit(): void {
    this.refreshPartyData();
    this.refreshLookups();
    this.refreshUser();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reservation']?.currentValue !== changes['reservation']?.previousValue) {
      this.refreshPartyData();
      this.refreshLookups();
      this.refreshUser();
    }
    if (changes['user']) {
      // parent podał usera – nadpisujemy lokalnego
      this.localUser = this.user() ?? null;
    }
  }

  ngOnDestroy(): void {
    this.subParty?.unsubscribe();
    this.subLookups?.unsubscribe();
    this.subUser?.unsubscribe();
  }

  // ── user (z Input albo z cache/backend)
  private refreshUser(): void {
    this.subUser?.unsubscribe();
    const fromInput = this.user();
    if (fromInput) {
      this.localUser = fromInput;
      return;
    }
    const uid = this.reservation().userId;
    if (!uid) {
      this.localUser = null;
      return;
    }
    this.subUser = this.users.getById(uid).subscribe(u => (this.localUser = u));
  }

  // ── party / badge’y
  private refreshPartyData(): void {
    this.subParty?.unsubscribe();

    this.partyName = '';
    this.badgeBeginners = false;
    this.badgeMyParty = false;
    this.badgeClub = false;

    const teamId = this.reservation().teamId;
    if (!teamId) return;

    this.subParty = this.party
      .getPartyById(teamId)
      .pipe(
        switchMap((p: IParty | null) => {
          this.partyName = p?.name ?? '';
          this.badgeBeginners = !!p?.beginnersProgram;

          const me = this.auth.user();
          this.badgeMyParty = !!(p && me && p.gmId === me.id);

          if (!p) return of(false);

          return this.party.getPartyMembers(p.id).pipe(
            map((members) =>
              members
                .filter((m) => !m.leftAt && (m.role === TeamRole.Player || m.role === TeamRole.Owner))
                .map((m) => m.userId)
            ),
            switchMap((playerIds) => {
              if (!playerIds.length) return of(false);
              return this.party.getUsersByIds(playerIds).pipe(
                map((users) => users.every((u) => u.coworker === CoworkerRoles.Member))
              );
            })
          );
        })
      )
      .subscribe((flag) => {
        this.badgeClub = flag;
      });
  }

  // ── GM + System
  private refreshLookups(): void {
    this.subLookups?.unsubscribe();
    const r = this.reservation();

    const sys$ = r.systemId
      ? this.backend.getById<IRPGSystem>('systems', r.systemId)
      : of<IRPGSystem | null>(null);

    const gm$ = r.gmId ? this.gmDirectory.getGmById(r.gmId) : of<IGmData | null>(null);

    this.subLookups = sys$
      .pipe(
        switchMap((sys) => {
          this.systemName = sys?.name ?? null;
          return gm$;
        })
      )
      .subscribe((gm) => (this.gm = gm ?? null));
  }

  // ── wyświetlanie
  get userDisplayName(): string {
    return this.auth.userDisplayName(this.localUser) || 'Brak danych';
  }

  get displayName(): string {
    return this.reservation().externalName || this.userDisplayName || 'Brak danych';
  }

  get displayPhone(): string {
    return this.reservation().externalPhone || this.localUser?.phoneNumber || 'Brak danych';
  }

  get gmDisplayName(): string {
    return this.gmDirectory.gmDisplayName(this.gm) || (this.reservation().needsGm ? 'Do przydziału' : '—');
  }

  readonly statusDisplay = ReservationStatusDisplay;
}
