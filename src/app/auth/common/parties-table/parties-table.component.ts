import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { BehaviorSubject, of, switchMap, map, shareReplay, startWith, forkJoin } from 'rxjs';

import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';
import { IUser } from '../../../core/interfaces/i-user';
import { IParty } from '../../../core/interfaces/parties/i-party';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PartyDetailsModalComponent } from '../party-details-modal/party-details-modal.component';

type Row = IParty & { ownerLabel: string; gmLabel: string };

@Component({
  selector: 'app-parties-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parties-table.component.html',
  styleUrls: ['./parties-table.component.scss'],
})
export class PartiesTableComponent {
  readonly partiesInput = input<IParty[] | null>(null);

  private readonly partyService = inject(PartyService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(NgbModal);
  private readonly router = inject(Router);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  private readonly baseParties$ = this.refresh$.pipe(
    switchMap(() => {
      const ext = this.partiesInput();
      if (ext) return of(ext);
      return this.partyService.getParties(undefined, 'name', 'asc');
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly rows$ = this.baseParties$.pipe(
    switchMap((teams) => {
      if (!teams.length) return of([] as Row[]);
      const ids = Array.from(new Set([
        ...(teams.map(t => t.ownerId).filter(Boolean) as string[]),
        ...(teams.map(t => t.gmId).filter(Boolean)    as string[]),
      ]));
      return this.partyService.getUsersByIds(ids).pipe(
        map((users) => {
          const byId = new Map(users.map(u => [u.id, u]));
          return teams.map<Row>(t => ({
            ...t,
            ownerLabel: this.userLabel(byId.get(t.ownerId ?? '') ?? null),
            gmLabel:    this.userLabel(byId.get(t.gmId    ?? '') ?? null),
          }));
        })
      );
    }),
    startWith([] as Row[]),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly rows = toSignal(this.rows$, { initialValue: [] as Row[] });
  readonly isLoading = computed(() => this.rows().length === 0);

  userLabel(u: IUser | null): string {
    if (!u) return '—';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName ?? u.email ?? '—';
  }

  readonly isPrivileged = computed(
    () => this.auth.userSystemRole() === SystemRole.Admin ||
          this.auth.userCoworkerRole() === CoworkerRoles.Reception
  );

  onToggleBeginners(team: Row, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const nextStage: 1 | 2 | null = checked ? team.programStage ?? 1 : null;
    this.partyService.updateBeginnersProgramAndStage(team.id, checked, nextStage)
      .subscribe(() => this.refresh$.next());
  }

  onStageChange(team: Row, ev: Event) {
    const v = (ev.target as HTMLSelectElement).value;
    const stage = v ? (Number(v) as 1 | 2) : null;
    this.partyService.updateProgramStage(team.id, stage)
      .subscribe(() => this.refresh$.next());
  }

  onShow(team: Row) {
    // Ładujemy wszystko, co potrzeba do modala
    const ownerId = team.ownerId ?? '';
    const gmId    = team.gmId ?? '';

    forkJoin({
      owner: ownerId ? this.partyService.getPartyOwnerData(ownerId) : of(null),
      gm:    gmId    ? this.partyService.getPartyOwnerData(gmId)    : of(null),
      members: this.partyService.getPartyMembers(team.id),
      systems: this.partyService.getPartySystems(team.id),
      profile: this.partyService.getPartyProfile(team.id),
    }).subscribe(({ owner, gm, members, systems, profile }) => {
      const ref = this.modal.open(PartyDetailsModalComponent, {
        size: 'lg',
        backdrop: 'static',
      });
      ref.componentInstance.team    = team;
      ref.componentInstance.owner   = owner;
      ref.componentInstance.gm      = gm;
      ref.componentInstance.members = members;
      ref.componentInstance.systems = systems;
      ref.componentInstance.profile = profile;
    });
  }

  onEdit(team: Row) {
    // jeśli chcesz od razu na edycję:
    this.router.navigate([`auth/edit-party/${team.slug}`]);
  }
}
