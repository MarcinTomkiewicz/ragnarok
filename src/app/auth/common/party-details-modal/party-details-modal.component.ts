import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { format } from 'date-fns';

import { IParty } from '../../../core/interfaces/parties/i-party';
import { IUser } from '../../../core/interfaces/i-user';
import {
  IPartyMember,
  MemberRow,
} from '../../../core/interfaces/parties/i-party-member';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IPartyProfile } from '../../../core/interfaces/parties/i-party-profile';
import { PartyService } from '../../core/services/party/party.service';
import { BehaviorSubject, of, switchMap, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TeamRole, TeamRoleLabels } from '../../../core/enums/team-role';

@Component({
  selector: 'app-party-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './party-details-modal.component.html',
  styleUrls: ['./party-details-modal.component.scss'],
})
export class PartyDetailsModalComponent {
  @Input() team!: IParty;
  @Input() owner: IUser | null = null;
  @Input() gm: IUser | null = null;
  @Input() systems: IRPGSystem[] = [];
  @Input() profile: IPartyProfile | null = null;

  private readonly membersSub$ = new BehaviorSubject<IPartyMember[]>([]);
  @Input() set members(value: IPartyMember[]) {
    this.membersSub$.next(value ?? []);
  }

  private readonly partyService = inject(PartyService);
  readonly activeModal = inject(NgbActiveModal);

  private readonly memberRows$ = this.membersSub$.pipe(
    switchMap((members) => {
      if (!members?.length) return of([] as MemberRow[]);
      const ids = Array.from(
        new Set(members.map((m) => m.userId).filter(Boolean) as string[])
      );
      if (!ids.length) return of([] as MemberRow[]);
      return this.partyService.getUsersByIds(ids).pipe(
        map((users) => {
          const byId = new Map(users.map((u) => [u.id, u]));
          return members.map<MemberRow>((m) => ({
            id: m.userId ?? crypto.randomUUID(),
            user: m.userId ? byId.get(m.userId) ?? null : null,
            role: this.normalizeRole(m.role),
          }));
        })
      );
    })
  );

  private normalizeRole(role: string | null | undefined): TeamRole {
    switch (role) {
      case 'owner':
        return TeamRole.Owner;
      case 'gm':
        return TeamRole.Gm;
      case 'guest':
        return TeamRole.Guest;
      case 'player':
        return TeamRole.Player;
      default:
        return TeamRole.Player;
    }
  }

  readonly memberRows = toSignal(this.memberRows$, {
    initialValue: [] as MemberRow[],
  });

  get createdAt(): string {
    const d = this.team.createdAt ? new Date(this.team.createdAt) : null;
    return d ? format(d, 'dd.MM.yyyy') : '—';
  }

  userLabel(u: IUser | null): string {
    if (!u) return '—';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName ?? u.email ?? '—';
  }

  get systemsDisplay(): string {
    return this.systems?.length
      ? this.systems.map((s) => s.name).join(', ')
      : '—';
  }

  get programDisplay(): string {
    if (!this.team.beginnersProgram) return 'Nie';
    const stage = this.team.programStage ?? null;
    return stage ? `Tak (etap ${stage})` : 'Tak';
  }

  roleLabel(r: string): string {
    return TeamRoleLabels[r as TeamRole] ?? r;
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
