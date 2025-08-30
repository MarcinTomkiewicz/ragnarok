import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, of } from 'rxjs';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IParty, Row } from '../../../core/interfaces/parties/i-party';
import { IPartyMember } from '../../../core/interfaces/parties/i-party-member';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { PartyListComponent } from '../../common/party-list/party-list.component';
import { PartyService } from '../../core/services/party/party.service';
import { Router } from '@angular/router';
import { PartyDetailsModalComponent } from '../../common/party-details-modal/party-details-modal.component';
import { IUser } from '../../../core/interfaces/i-user';
import { CoworkerRoles } from '../../../core/enums/roles';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

@Component({
  selector: 'app-my-parties',
  standalone: true,
  imports: [CommonModule, PartyListComponent],
  templateUrl: './my-parties.component.html',
})
export class MyTeamsComponent {
  private readonly partyService = inject(PartyService);
  private readonly modal = inject(NgbModal);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user()!;

  readonly leaveSuccessToast = viewChild<TemplateRef<unknown>>('leaveSuccessToast');
  readonly leaveErrorToast   = viewChild<TemplateRef<unknown>>('leaveErrorToast');

  readonly gmTeams: WritableSignal<IParty[]>    = signal<IParty[]>([]);
  readonly ownerTeams: WritableSignal<IParty[]> = signal<IParty[]>([]);
  readonly memberTeams: WritableSignal<IParty[]> = signal<IParty[]>([]);

  readonly teamMembers: WritableSignal<IPartyMember[]> = signal([]);
  readonly teamSystems: WritableSignal<IRPGSystem[]>   = signal([]);

  readonly canShowGmSection = computed(() =>
    hasMinimumCoworkerRole(this.auth.user(), CoworkerRoles.Gm)
  );

  readonly isEmpty = computed(
    () => !this.gmTeams().length && !this.ownerTeams().length && !this.memberTeams().length
  );

  constructor() {
    this.loadTeams();
  }

  private loadTeams(): void {
    const u = this.auth.user();
    if (!u?.id) return;
    const userId = u.id;

    const gm$     = this.canShowGmSection() ? this.partyService.getPartiesWhereGm(userId) : of<IParty[]>([]);
    const owner$  = this.partyService.getPartiesOwnedBy(userId);
    const member$ = this.partyService.getPartiesWhereMember(userId);

    forkJoin([gm$, owner$, member$]).subscribe(([gmTeams, ownerTeams, memberTeams]) => {
      const gmIds    = new Set(gmTeams.map(t => t.id));
      const ownerIds = new Set(ownerTeams.map(t => t.id));

      const ownerOnly  = ownerTeams.filter(t => !gmIds.has(t.id));
      const memberOnly = memberTeams.filter(t => !gmIds.has(t.id) && !ownerIds.has(t.id));

      this.gmTeams.set(gmTeams);
      this.ownerTeams.set(ownerOnly);
      this.memberTeams.set(memberOnly);
    });
  }

  onShowDetails(team: IParty) {
    const ownerId = team.ownerId ?? '';
    const gmId    = team.gmId ?? '';

    forkJoin({
      owner: ownerId ? this.partyService.getPartyOwnerData(ownerId) : of(null),
      gm:    gmId    ? this.partyService.getPartyOwnerData(gmId)    : of(null),
      members: this.partyService.getPartyMembers(team.id),
      systems: this.partyService.getPartySystems(team.id),
      profile: this.partyService.getPartyProfile(team.id),
    }).subscribe({
      next: ({ owner, gm, members, systems, profile }) => {
        const row: Row = {
          ...team,
          ownerLabel: this.userLabel(owner),
          gmLabel:    this.userLabel(gm),
        };

        const ref = this.modal.open(PartyDetailsModalComponent, {
          size: 'lg',
          backdrop: 'static',
        });

        ref.componentInstance.team    = row;
        ref.componentInstance.owner   = owner;
        ref.componentInstance.gm      = gm;
        ref.componentInstance.members = members;
        ref.componentInstance.systems = systems;
        ref.componentInstance.profile = profile;
      },
      error: (err) => console.error('Błąd podczas ładowania danych drużyny:', err),
    });
  }

  onEditParty(team: IParty): void {
    this.router.navigate([`auth/edit-party/${team.slug}`]);
  }

  private userLabel(u: IUser | null): string {
    if (!u) return '—';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName ?? u.email ?? '—';
  }

  private showLeaveSuccessToast(): void {
    const template = this.leaveSuccessToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-success text-white',
        header: 'Drużyna opuszczona',
      });
    }
  }

  private showLeaveAbortedToast(): void {
    const template = this.leaveErrorToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-warning text-black',
        header: 'Opuszczanie przerwane',
      });
    }
  }

  private showLeaveErrorToast(): void {
    const template = this.leaveErrorToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-danger text-white',
        header: 'Błąd opuszczania drużyny',
      });
    }
  }
}
