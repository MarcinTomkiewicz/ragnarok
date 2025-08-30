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

@Component({
  selector: 'app-my-parties',
  standalone: true,
  imports: [CommonModule, PartyListComponent],
  templateUrl: './my-parties.component.html',
})
export class MyTeamsComponent {
  // === DI ===
  private readonly partyService = inject(PartyService);
  private readonly modal = inject(NgbModal);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user()!;

  // === Toast templates ===
  readonly leaveSuccessToast =
    viewChild<TemplateRef<unknown>>('leaveSuccessToast');
  readonly leaveErrorToast = viewChild<TemplateRef<unknown>>('leaveErrorToast');

  // === Signals ===
  private readonly teamsSignal: WritableSignal<IParty[]> = signal([]);
  readonly filteredTeams = computed(() => this.teamsSignal());
  readonly teamMembers: WritableSignal<IPartyMember[]> = signal([]);
  readonly teamSystems: WritableSignal<IRPGSystem[]> = signal([]);

  constructor() {
    this.loadTeams();
  }

  onShowDetails(team: IParty) {
    const ownerId = team.ownerId ?? '';
    const gmId = team.gmId ?? '';

    forkJoin({
      owner: ownerId ? this.partyService.getPartyOwnerData(ownerId) : of(null),
      gm: gmId ? this.partyService.getPartyOwnerData(gmId) : of(null),
      members: this.partyService.getPartyMembers(team.id),
      systems: this.partyService.getPartySystems(team.id),
      profile: this.partyService.getPartyProfile(team.id),
    }).subscribe({
      next: ({ owner, gm, members, systems, profile }) => {
        const ownerLabel = this.userLabel(owner);
        const gmLabel = this.userLabel(gm);

        // Zbuduj Row na podstawie IParty + etykiety
        const row: Row = {
          ...team,
          ownerLabel,
          gmLabel,
        };

        const ref = this.modal.open(PartyDetailsModalComponent, {
          size: 'lg',
          backdrop: 'static',
        });

        // Do modala wysyłamy Row
        ref.componentInstance.team = row;

        // oraz resztę danych jak wcześniej (pełni użytkownicy itd.)
        ref.componentInstance.owner = owner;
        ref.componentInstance.gm = gm;
        ref.componentInstance.members = members;
        ref.componentInstance.systems = systems;
        ref.componentInstance.profile = profile;
      },
      error: (err) => {
        console.error('Błąd podczas ładowania danych drużyny:', err);
      },
    });
  }

  private userLabel(u: IUser | null): string {
    if (!u) return '—';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName ?? u.email ?? '—';
  }

  onEditParty(team: IParty): void {
    this.router.navigate([`auth/edit-party/${team.slug}`]);
  }

  // openLeaveModal(teamId: string): void {
  //   const modalRef = this.modal.open(InfoModalComponent, {
  //     size: 'md',
  //     backdrop: 'static',
  //     keyboard: false,
  //   });

  //   modalRef.componentInstance.header = 'Potwierdzenie';
  //   modalRef.componentInstance.message =
  //     'Czy na pewno chcesz opuścić tę drużynę?';
  //   modalRef.componentInstance.showCancel = true;

  //   from(modalRef.result)
  //     .pipe(
  //       switchMap((confirmed) => {
  //         if (!confirmed) {
  //           this.showLeaveAbortedToast();
  //           return [];
  //         }

  //         return this.PartyService.leaveTeam(teamId).pipe(
  //           tap(() => this.showLeaveSuccessToast()),
  //           catchError(() => {
  //             this.showLeaveErrorToast();
  //             return [];
  //           })
  //         );
  //       }),
  //       catchError(() => {
  //         this.showLeaveAbortedToast();
  //         return [];
  //       })
  //     )
  //     .subscribe(() => {
  //       this.loadTeams();
  //     });
  // }

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

  private loadTeams(): void {
    if (!this.auth.user()) return;
    const userId = this.auth.user()?.id;
    this.partyService.getPartiesByUser(userId!!).subscribe((teams) => {
      this.teamsSignal.set(teams ?? []);
    });
  }

  // onManage(team: IParty): void {
  //   this.openLeaveModal(team.id);
  // }
}
