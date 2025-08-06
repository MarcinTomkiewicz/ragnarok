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
import { ITeam } from '../../../core/interfaces/teams/i-team';
import { ToastService } from '../../../core/services/toast/toast.service';
import { TeamService } from '../../core/services/team/team.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { TeamListComponent } from '../../common/team-list/team-list.component';
import { ITeamMember } from '../../../core/interfaces/teams/i-team-member';
import { ITeamSystem } from '../../../core/interfaces/teams/i-team-system';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { first, forkJoin } from 'rxjs';

@Component({
  selector: 'app-my-teams',
  standalone: true,
  imports: [CommonModule, TeamListComponent],
  templateUrl: './my-teams.component.html',
})
export class MyTeamsComponent {
  // === DI ===
  private readonly teamService = inject(TeamService);
  private readonly modal = inject(NgbModal);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user()!;

  // === Toast templates ===
  readonly leaveSuccessToast =
    viewChild<TemplateRef<unknown>>('leaveSuccessToast');
  readonly leaveErrorToast = viewChild<TemplateRef<unknown>>('leaveErrorToast');

  // === Signals ===
  private readonly teamsSignal: WritableSignal<ITeam[]> = signal([]);
  readonly filteredTeams = computed(() => this.teamsSignal());
  readonly teamMembers: WritableSignal<ITeamMember[]> = signal([]);
  readonly teamSystems: WritableSignal<IRPGSystem[]> = signal([]);

  constructor() {
    this.loadTeams();
  }

  onShowDetails(team: ITeam): void {
    console.log('Szczegóły drużyny:', team);

    // Używamy forkJoin, żeby poczekać na pobranie członków i systemów drużyny
    forkJoin([
      this.teamService.getTeamMembers(team.id), // Pobieramy członków drużyny
      this.teamService.getTeamSystems(team.id),
      this.teamService.getTeamProfile(team.id), // Pobieramy systemy drużyny
    ]).subscribe({
      next: ([members, systems, profile]) => {
        // Po załadowaniu danych wyświetlamy je w konsoli
        console.log('Członkowie drużyny:', members);
        console.log('Systemy drużyny:', systems);
        console.log('Profil drużyny:', profile);
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

  //         return this.teamService.leaveTeam(teamId).pipe(
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
    this.teamService.getTeamsByUser(userId!!).subscribe((teams) => {
      this.teamsSignal.set(teams ?? []);
    });
  }

  // onManage(team: ITeam): void {
  //   this.openLeaveModal(team.id);
  // }
}
