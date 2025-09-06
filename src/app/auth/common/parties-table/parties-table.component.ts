import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';

import { NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  alreadyThereLabel,
  waitingForApprovalLabel,
  maxPartyMembers,
  PartyType,
  PartyTypeLabels,
  PartyMemberStatus,
} from '../../../core/enums/party.enum';
import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';
import { IUser } from '../../../core/interfaces/i-user';
import { IParty, Row } from '../../../core/interfaces/parties/i-party';
import { IPartyMember } from '../../../core/interfaces/parties/i-party-member';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PartyService } from '../../core/services/party/party.service';
import { PartyDetailsModalComponent } from '../party-details-modal/party-details-modal.component';

@Component({
  selector: 'app-parties-table',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './parties-table.component.html',
  styleUrls: ['./parties-table.component.scss'],
})
export class PartiesTableComponent {
  readonly publicMode = input(false);
  readonly partiesInput = input<IParty[] | null>(null);

  private readonly partyService = inject(PartyService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(NgbModal);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly user = this.auth.user;

  readonly PartyType = PartyType;
  readonly PartyTypeLabels = PartyTypeLabels;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  // public/private tryb
  private readonly publicModeInput$ = toObservable(this.publicMode);
  private readonly publicModeFromData$ = this.route.data.pipe(map((d) => !!d['publicMode']));
  private readonly effectivePublicMode$ = combineLatest([
    this.publicModeInput$,
    this.publicModeFromData$,
  ]).pipe(
    map(([fromInput, fromData]) => !!(fromInput || fromData)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // źródło drużyn
  private readonly baseParties$ = combineLatest([
    this.refresh$,
    this.effectivePublicMode$,
    toObservable(this.user),
  ]).pipe(
    switchMap(([, isPublic, u]) => {
      const ext = this.partiesInput();
      const source$ = ext
        ? of(ext)
        : isPublic
        ? this.partyService.getOpenParties('name', 'asc')
        : this.partyService.getParties(undefined, 'name', 'asc');

      return source$.pipe(
        map((teams) => {
          if (!isPublic) return teams;
          const uid = u?.id ?? null;
          return teams.filter(
            (t) =>
              (t as IParty).isOpen === true &&
              (!uid || t.ownerId !== uid) &&
              !t.beginnersProgram
          );
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // członkowie per drużyna
  private readonly membersByTeam$ = this.baseParties$.pipe(
    switchMap((teams) => {
      if (!teams.length) return of(new Map<string, IPartyMember[]>());
      return forkJoin(
        teams.map((t) =>
          this.partyService.getPartyMembers(t.id).pipe(map((m) => [t.id, m] as const))
        )
      ).pipe(map((entries) => new Map<string, IPartyMember[]>(entries)));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // użytkownicy do etykiet właściciel/MG
  private readonly rows$ = this.baseParties$.pipe(
    switchMap((teams) => {
      if (!teams.length) return of([] as Row[]);
      const ids = Array.from(
        new Set([
          ...(teams.map((t) => t.ownerId).filter(Boolean) as string[]),
          ...(teams.map((t) => t.gmId).filter(Boolean) as string[]),
        ])
      );
      return this.partyService.getUsersByIds(ids).pipe(
        map((users) => {
          const byId = new Map(users.map((u) => [u.id, u]));
          return teams.map<Row>((t) => ({
            ...t,
            ownerLabel: this.userLabel(byId.get(t.ownerId ?? '') ?? null),
            gmLabel: this.userLabel(byId.get(t.gmId ?? '') ?? null),
          }));
        })
      );
    }),
    startWith([] as Row[]),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // typ drużyny
  private readonly usersById$ = this.membersByTeam$.pipe(
    switchMap((byTeam) => {
      const allIds = Array.from(byTeam.values()).flat().map((m) => m.userId);
      const unique = Array.from(new Set(allIds));
      if (!unique.length) return of(new Map<string, IUser>());
      return this.partyService
        .getUsersByIds(unique)
        .pipe(map((users) => new Map(users.map((u) => [u.id, u]))));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly teamTypeById$ = combineLatest([this.membersByTeam$, this.usersById$]).pipe(
    map(([byTeam, usersById]) => this.partyService.computeTeamTypes(byTeam, usersById)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // ---- Signals do templatki
  readonly rows = toSignal(this.rows$, { initialValue: [] as Row[] });
  readonly isLoading = computed(() => this.rows().length === 0);
  readonly membersByTeam = toSignal(this.membersByTeam$, {
    initialValue: new Map<string, IPartyMember[]>(),
  });
  readonly teamTypeById = toSignal(this.teamTypeById$, {
    initialValue: new Map<string, PartyType>(),
  });

  // stałe / etykiety
  readonly maxMembers = maxPartyMembers;
  readonly alreadyThereLabel = alreadyThereLabel;
  readonly waitingForApprovalLabel = waitingForApprovalLabel;

  // ---- Helpers domenowe

  /** Aktywni (liczą się do limitu) */
  private activeMembers(teamId: string): IPartyMember[] {
    const arr = this.membersByTeam().get(teamId) ?? [];
    return arr.filter(
      (m) => !m.leftAt && m.memberStatus === PartyMemberStatus.Active
    );
  }
  activeCount(teamId: string): number {
    return this.activeMembers(teamId).length;
  }
  isFull(teamId: string): boolean {
    return this.activeCount(teamId) >= this.maxMembers;
  }

  /** Status aktualnego użytkownika w danej drużynie (tylko nienopusczeni) */
  myStatus(teamId: string): PartyMemberStatus | null {
    const uid = this.user()?.id ?? null;
    if (!uid) return null;
    const arr = this.membersByTeam().get(teamId) ?? [];
    const m = arr.find((x) => x.userId === uid && !x.leftAt) ?? null;
    return m?.memberStatus ?? null;
  }
  isMyActive(teamId: string): boolean {
    return this.myStatus(teamId) === PartyMemberStatus.Active;
  }
  isMyPending(teamId: string): boolean {
    return this.myStatus(teamId) === PartyMemberStatus.Pending;
  }

  /** Etykieta i tytuł przycisku akcji */
  actionLabel(teamId: string): string {
    if (this.isMyPending(teamId)) return this.waitingForApprovalLabel;
    if (this.isMyActive(teamId)) return this.alreadyThereLabel;
    return 'Dołącz';
  }
  actionTitle(teamId: string): string {
    if (this.isMyPending(teamId)) return this.waitingForApprovalLabel;
    if (this.isMyActive(teamId)) return this.alreadyThereLabel;
    return this.canJoinCached(teamId) ? '' : 'Brak możliwości dołączenia';
  }

  /** wersja do użycia w *ngIf: używa aktualnych danych */
  canJoin(team: Row): boolean {
    const uid = this.user()?.id ?? null;
    if (!uid) return false;
    if (!(team as IParty).isOpen) return false;
    if (this.isFull(team.id)) return false;
    if (this.isMyActive(team.id) || this.isMyPending(team.id)) return false;
    if (team.ownerId === uid || team.gmId === uid) return false;
    return true;
  }
  /** przydatne do title/disabled bez przekazywania całego teamu */
  private canJoinCached(teamId: string): boolean {
    const team = this.rows().find((r) => r.id === teamId);
    return team ? this.canJoin(team) : false;
  }

  // ---- UI helpers
  userLabel(u: IUser | null): string {
    if (!u) return '—';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName ?? u.email ?? '—';
  }

  readonly isPrivileged = computed(
    () =>
      this.auth.userSystemRole() === SystemRole.Admin ||
      this.auth.userCoworkerRole() === CoworkerRoles.Reception
  );

  // ---- Actions
  onJoin(team: Row, ev?: Event) {
    (ev?.currentTarget as HTMLElement | null)?.blur();
    if (!this.canJoin(team)) return;
    const uid = this.user()?.id ?? null;
    if (!uid) return;
    this.partyService.requestToJoin(team.id, uid).subscribe(() => this.refresh$.next());
  }

  onToggleBeginners(team: Row, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const nextStage: 1 | 2 | null = checked ? team.programStage ?? 1 : null;
    this.partyService
      .updateBeginnersProgramAndStage(team.id, checked, nextStage)
      .subscribe(() => this.refresh$.next());
  }

  onStageChange(team: Row, ev: Event) {
    const v = (ev.target as HTMLSelectElement).value;
    const stage = v ? (Number(v) as 1 | 2) : null;
    this.partyService.updateProgramStage(team.id, stage).subscribe(() => this.refresh$.next());
  }
  onStageSelect(team: Row, stage: 1 | 2 | null): void {
    this.partyService.updateProgramStage(team.id, stage).subscribe(() => this.refresh$.next());
  }

  onShow(team: Row, ev?: Event) {
    const opener =
      (ev?.currentTarget as HTMLElement) ??
      (document.activeElement as HTMLElement | null);
    opener?.blur();

    const ownerId = team.ownerId ?? '';
    const gmId = team.gmId ?? '';

    forkJoin({
      owner: ownerId ? this.partyService.getPartyOwnerData(ownerId) : of(null),
      gm: gmId ? this.partyService.getPartyOwnerData(gmId) : of(null),
      members: this.partyService.getPartyMembers(team.id),
      systems: this.partyService.getPartySystems(team.id),
      profile: this.partyService.getPartyProfile(team.id),
    }).subscribe(({ owner, gm, members, systems, profile }) => {
      const ref = this.modal.open(PartyDetailsModalComponent, {
        size: 'lg',
        backdrop: 'static',
      });

      ref.componentInstance.team = team;
      ref.componentInstance.owner = owner;
      ref.componentInstance.gm = gm;
      ref.componentInstance.members = members;
      ref.componentInstance.systems = systems;
      ref.componentInstance.profile = profile;

      const restoreFocus = () => {
        setTimeout(() => requestAnimationFrame(() => opener?.focus()), 0);
      };
      ref.closed.subscribe(restoreFocus);
      ref.dismissed.subscribe(restoreFocus);
    });
  }

  onEdit(team: Row, ev?: Event) {
    (ev?.currentTarget as HTMLElement | null)?.blur();
    this.router.navigate([`auth/edit-party/${team.slug}`]);
  }
}
