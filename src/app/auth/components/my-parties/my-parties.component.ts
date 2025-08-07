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
import { forkJoin } from 'rxjs';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IParty } from '../../../core/interfaces/parties/i-party';
import { IPartyMember } from '../../../core/interfaces/parties/i-party-member';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { PartyListComponent } from '../../common/party-list/party-list.component';
import { PartyService } from '../../core/services/party/party.service';

@Component({
  selector: 'app-my-parties',
  standalone: true,
  imports: [CommonModule, PartyListComponent],
  templateUrl: './my-parties.component.html',
})
export class MyTeamsComponent {
  // === DI ===
  private readonly PartyService = inject(PartyService);
  private readonly modal = inject(NgbModal);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);

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

  onShowDetails(team: IParty): void {
    forkJoin([
      this.PartyService.getPartyMembers(team.id),
      this.PartyService.getPartySystems(team.id),
      this.PartyService.getPartyProfile(team.id),
      this.PartyService.getPartyOwnerData(team.ownerId),
    ]).subscribe({
      next: ([members, systems, profile, owner]) => {
        console.log('Szczegóły drużyny:', team);
        console.log('Członkowie drużyny:', members);
        console.log('Systemy drużyny:', systems);
        console.log('Profil drużyny:', profile);
        console.log('Właściciel drużyny:', owner);
      },
      error: (err) => {
        console.error('Błąd podczas ładowania danych drużyny:', err);
      },
    });
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
    this.PartyService.getPartiesByUser(userId!!).subscribe((teams) => {
      this.teamsSignal.set(teams ?? []);
    });
  }

  // onManage(team: IParty): void {
  //   this.openLeaveModal(team.id);
  // }
}
