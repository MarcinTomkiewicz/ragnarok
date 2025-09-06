import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, debounceTime, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';
import { CoworkerRoles } from '../../../core/enums/roles';
import { PartyMemberStatus } from '../../../core/enums/party.enum';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IUser } from '../../../core/interfaces/i-user';
import { IParty } from '../../../core/interfaces/parties/i-party';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { SystemService } from '../../../core/services/system/system.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';
import { maxThreeStyles } from '../../../core/utils/tag-limiter';
import { stringToSlug } from '../../../core/utils/type-mappers';
import { GmService } from '../../core/services/gm/gm.service';
import { PartyService } from '../../core/services/party/party.service';
import { InfoModalComponent } from '../../../common/info-modal/info-modal.component';

enum Modes {
  Edit = 'Zaktualizowano',
  Create = 'Utworzono',
}
enum FailModes {
  Edit = 'zaktualizować',
  Create = 'utworzyć',
}
enum SuccessModes {
  Edit = 'zaktualizowana',
  Create = 'utworzona',
}

@Component({
  selector: 'app-create-party',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDropdownModule],
  templateUrl: './create-party.component.html',
  styleUrl: './create-party.component.scss',
})
export class CreatePartyComponent {
  readonly teamForm: FormGroup;
  private readonly fb = inject(FormBuilder);
  private readonly partyService = inject(PartyService);
  private readonly auth = inject(AuthService);
  private readonly backendService = inject(BackendService);
  private readonly gmService = inject(GmService);
  private readonly systemService = inject(SystemService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modal = inject(NgbModal);

  readonly CoworkerRoles = CoworkerRoles;
  readonly user = this.auth.user;

  // Czy pokazać "Tylko dla Klubowiczów"
  readonly canSeeClubOnly = computed(() =>
    hasMinimumCoworkerRole(this.user(), CoworkerRoles.Member)
  );

  // listy do UI
  gmsList = signal<IGmData[]>([]);
  membersList = signal<IUser[]>([]);
  systemsList = computed(() => this.systemService.systems());

  GmStyleTag = GmStyleTag;
  GmStyleTagLabels = GmStyleTagLabels;

  filteredSystems: IRPGSystem[] = [];
  filteredMembers: IUser[] = [];
  filteredGms: IGmData[] = [];

  private allowedSystemIds: Set<string> | null = null;
  private lastSystemsSearchTerm = '';
  private lastMembersSearchTerm = ''; // <— dla refiltra po zmianie isClubParty

  partySlug: string | null = null;
  editMode = false;
  partyData!: IParty;
  private currentTeamId: string | null = null;

  // oczekujące prośby (widoczne tylko w edycji)
  readonly pendingMembers = signal<{ id: string; userId: string }[]>([]);

  // aktywni członkowie z DB (po userId) — do rozróżniania lokalnych vs zapisanych
  readonly dbActiveMemberIds = signal<Set<string>>(new Set());

  modeMessage = this.editMode ? Modes.Edit : Modes.Create;
  modeFailMessage = this.editMode ? FailModes.Edit : FailModes.Create;
  modeSuccessMessage = this.editMode ? SuccessModes.Edit : SuccessModes.Create;

  systemsSearchTerm$ = new BehaviorSubject<string>('');
  membersSearchTerm$ = new BehaviorSubject<string>('');
  gmSearchTerm$ = new BehaviorSubject<string>('');

  readonly partySuccessToast =
    viewChild<TemplateRef<unknown>>('partySuccessToast');
  readonly partyErrorToast = viewChild<TemplateRef<unknown>>('partyErrorToast');

  constructor() {
    this.teamForm = this.fb.group({
      name: ['', Validators.required],
      gmId: [null],
      description: [''],

      beginnersProgram: [false],
      programStage: [null],

      notes: [''],

      addSelf: [false],

      members: this.fb.array([]),
      systems: this.fb.array([]),

      styleTags: this.fb.array([], maxThreeStyles),

      isOpen: [true],
      isForBeginners: [false],
      isClubParty: [false], // nowa flaga
    });

    this.systemService.loadAvailableSystems();

    this.route.data.subscribe((data) => {
      if (data['party']) {
        this.partyData = data['party'];
        this.partySlug = this.partyData.slug;
        this.editMode = true;
        this.currentTeamId = this.partyData.id;
        this.loadPartyData();
      }
    });
  }

  ngOnInit(): void {
    if (this.editMode && this.partySlug) this.loadPartyData();

    // GM list
    this.gmService.getAllGms().subscribe((gms) => {
      this.gmsList.set(gms);
      this.filteredGms = this.gmsList();
    });

    // katalog użytkowników
    this.backendService
      .getAll<IUser>('users', 'firstName', 'asc', {
        filters: {
          coworker: {
            value: [
              CoworkerRoles.Member,
              CoworkerRoles.User,
              CoworkerRoles.Golden,
            ],
            operator: FilterOperator.IN,
          },
        },
      })
      .subscribe((users) => {
        this.membersList.set(users);
        this.filteredMembers = this.membersList();
      });

    // Systems (pełna lista startowa / + filtr po MG)
    this.applySystemFilter('');

    // „Dodaj mnie”
    this.teamForm
      .get('addSelf')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked: boolean) => {
        if (checked) this.ensureSelfInMembers();
        else this.removeSelfFromMembers();
      });

    // wyszukiwarki
    this.systemsSearchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.filterItems(term, 'systems'));

    this.membersSearchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.lastMembersSearchTerm = term ?? '';
        this.filterItems(term, 'members');
      });

    this.gmSearchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.filterItems(term, 'gms'));

    // zmiana MG => ogranicz systemy
    this.teamForm
      .get('gmId')!
      .valueChanges.pipe(
        switchMap((gmId: string | null) =>
          gmId
            ? this.gmService.getSystemsForGm(gmId)
            : of<IRPGSystem[] | null>(null)
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((systemsOrNull) => {
        this.allowedSystemIds = systemsOrNull
          ? new Set(systemsOrNull.map((s) => s.id))
          : null;
        this.applySystemFilter(this.lastSystemsSearchTerm);
        if (this.allowedSystemIds)
          this.pruneSelectedSystems(this.allowedSystemIds);
      });

    // reaguj na zmianę isClubParty:
    this.teamForm
      .get('isClubParty')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isClub: boolean) => this.onClubOnlyToggle(isClub));

    // wstępne ograniczenie po istniejącym GM (edycja)
    const initialGm = this.teamForm.get('gmId')?.value as string | null;
    if (initialGm) {
      this.gmService.getSystemsForGm(initialGm).subscribe((sys) => {
        this.allowedSystemIds = new Set(sys.map((s) => s.id));
        this.applySystemFilter(this.lastSystemsSearchTerm);
        this.pruneSelectedSystems(this.allowedSystemIds!);
      });
    }
  }

  // =========================
  // Load edit data
  // =========================
  loadPartyData(): void {
    if (!this.partySlug || this.teamForm.dirty) return;

    this.partyService.getPartyBySlug(this.partySlug).subscribe((party) => {
      if (!party) return;
      if (this.teamForm.get('name')?.value) return;

      this.currentTeamId = party.id;

      this.teamForm.patchValue({
        name: party.name,
        gmId: party.gmId,
        beginnersProgram: party.beginnersProgram,
        programStage: party.programStage,
        notes: party.notes,
        isOpen: party.isOpen,
        isForBeginners: party.isForBeginners,
        isClubParty: party.isClubParty,
      });

      forkJoin([
        this.partyService.getPartyProfile(party.id),
        this.partyService.getPartySystems(party.id),
      ]).subscribe(([profile, systems]) => {
        if (profile) {
          this.teamForm.patchValue({ description: profile.description });
          const styleTags = profile.styleTags || [];
          styleTags.forEach((tag: GmStyleTag) => {
            if (!this.styleTagControls.value.includes(tag)) {
              this.styleTagControls.push(this.fb.control(tag));
            }
          });
        }

        if (systems) {
          systems.forEach((s) =>
            this.systemControls.push(this.fb.control(s.id))
          );
        }
      });

      // aktywni i oczekujący ładowani osobno i synchronizowani z formularzem
      this.refreshMembersForEdit();

      // jeśli po wczytaniu jest tryb klubowy — przefiltruj listę wyboru członków
      if (this.teamForm.get('isClubParty')?.value) {
        this.filterItems(this.lastMembersSearchTerm, 'members');
      }
    });
  }

  /** Pobiera z backendu Active + Pending, rozdziela i synchronizuje z formularzem. */
  private refreshMembersForEdit(): void {
    if (!this.currentTeamId) return;

    this.partyService
      .getActiveAndPendingMembers(this.currentTeamId)
      .subscribe((members) => {
        const active = members.filter(
          (m) => m.memberStatus === PartyMemberStatus.Active && !m.leftAt
        );
        const pending = members.filter(
          (m) => m.memberStatus === PartyMemberStatus.Pending && !m.leftAt
        );

        // aktywni z DB -> Set do rozróżniania przy kasowaniu
        const activeIdsFromDb = Array.from(
          new Set(active.map((m) => m.userId).filter(Boolean) as string[])
        );
        this.dbActiveMemberIds.set(new Set(activeIdsFromDb));

        // scal aktywnych z ewentualnymi lokalnymi wyborami, przytnij do 5
        const current = new Set(this.membersControls.value as string[]);
        const merged = Array.from(
          new Set([...activeIdsFromDb, ...current])
        ).slice(0, 5);
        this.setFormArray(this.membersControls, merged);

        // ustaw „dodaj mnie”
        const me = this.auth.user()?.id ?? null;
        const hasMe = !!me && merged.includes(me);
        this.teamForm.get('addSelf')!.setValue(hasMe, { emitEvent: false });

        // oczekujący
        this.pendingMembers.set(
          pending.map((p) => ({ id: p.id, userId: p.userId }))
        );
      });
  }

  // =========================
  // Club-only toggle (zad. 1 i 2)
  // =========================
  private onClubOnlyToggle(isClub: boolean): void {
    if (isClub) {
      // 1) sprawdź, czy na liście wybranych jest ktokolwiek nie-Member
      const nonClubPresent = (this.membersControls.value as string[]).some(
        (id) => this.userCoworker(id) !== CoworkerRoles.Member
      );
      if (nonClubPresent) {
        // 2) pokaż info modal i cofnij zaznaczenie
        this.openInfo(
          'Przed ustawieniem drużyny "Tylko dla Klubowiczów" usuń z drużyny wszystkie osoby, niebędące Członkami Klubu Gier Fabularnych!'
        );
        this.teamForm.get('isClubParty')!.setValue(false, { emitEvent: false });
        return;
      }
    }
    // niezależnie od wartości — przefiltruj listę wyboru członków
    this.filterItems(this.lastMembersSearchTerm, 'members');
  }

  private openInfo(message: string): void {
    const ref = this.modal.open(InfoModalComponent, { backdrop: 'static' });
    ref.componentInstance.header = 'Informacja';
    ref.componentInstance.message = message;
    ref.componentInstance.showCancel = false; // tylko OK
  }

  // =========================
  // Members helpers
  // =========================
  private ensureSelfInMembers(): void {
    const me = this.auth.user()?.id ?? null;
    if (!me) return;
    const ctrl = this.membersControls;
    if (!ctrl.value.includes(me)) {
      if (ctrl.length >= 5) return;
      ctrl.push(this.fb.control(me));
    }
  }

  private removeSelfFromMembers(): void {
    const me = this.auth.user()?.id ?? null;
    if (!me) return;
    const ctrl = this.membersControls;
    const idx = ctrl.value.indexOf(me);
    if (idx >= 0) ctrl.removeAt(idx);
  }

  private setFormArray(ctrl: FormArray, values: string[]): void {
    while (ctrl.length) ctrl.removeAt(ctrl.length - 1);
    values.forEach((v) => ctrl.push(this.fb.control(v)));
  }

  isDbActiveMember(userId: string): boolean {
    return this.dbActiveMemberIds().has(userId);
  }

  // =========================
  // Filtering & selection
  // =========================
  onSearchChange(event: Event, type: 'systems' | 'members' | 'gms'): void {
    const input = event.target as HTMLInputElement;
    if (type === 'systems') this.systemsSearchTerm$.next(input.value);
    else if (type === 'members') this.membersSearchTerm$.next(input.value);
    else this.gmSearchTerm$.next(input.value);
  }

  filterItems(term: string, type: 'systems' | 'members' | 'gms'): void {
    if (type === 'systems') {
      this.applySystemFilter(term);
    } else if (type === 'members') {
      // baza: cały katalog
      let base = this.membersList();

      // ogranicz do Member gdy isClubParty = true
      if (this.teamForm.get('isClubParty')?.value) {
        base = base.filter((u) => u.coworker === CoworkerRoles.Member);
      }

      // min 3 znaki do wyszukiwarki (jak wcześniej)
      this.filteredMembers =
        term && term.length >= 3
          ? base.filter((m) =>
              `${this.getUserDisplayName(m)} ${m.email}`
                .toLowerCase()
                .includes(term.toLowerCase())
            )
          : base;
    } else {
      const src = this.gmsList();
      this.filteredGms =
        term && term.length >= 3
          ? src.filter((g) =>
              this.gmDisplayName(g).toLowerCase().includes(term.toLowerCase())
            )
          : src;
    }
  }

  private applySystemFilter(term: string): void {
    this.lastSystemsSearchTerm = term ?? '';
    const all = this.systemsList();
    const allowed = this.allowedSystemIds;

    let base = all;
    if (allowed) base = all.filter((s) => allowed.has(s.id));

    this.filteredSystems =
      term && term.length >= 3
        ? base.filter((s) => s.name.toLowerCase().includes(term.toLowerCase()))
        : base;
  }

  private pruneSelectedSystems(allowed: Set<string>): void {
    const ctrl = this.systemControls;
    for (let i = ctrl.length - 1; i >= 0; i--) {
      const id = ctrl.at(i).value;
      if (!allowed.has(id)) ctrl.removeAt(i);
    }
  }

  onItemChange(event: Event, type: 'systems' | 'members'): void {
    const target = event.target as HTMLSelectElement;
    if (!target?.selectedOptions) return;

    const selectedValues = Array.from(target.selectedOptions).map(
      (o) => o.value
    );
    const controls =
      type === 'systems' ? this.systemControls : this.membersControls;

    selectedValues.forEach((id) => {
      if (controls.value.length < 5 && !controls.value.includes(id)) {
        controls.push(this.fb.control(id));
      }
    });
  }

  removeItem(itemId: string, type: 'systems' | 'members'): void {
    if (type === 'systems') {
      const controls = this.systemControls;
      const i = controls.value.indexOf(itemId);
      if (i >= 0) controls.removeAt(i);
      return;
    }

    // type === 'members'
    const controls = this.membersControls;
    const i = controls.value.indexOf(itemId);
    if (i >= 0) controls.removeAt(i);

    // jeśli usuwa siebie — odznacz „dodaj mnie”
    const me = this.auth.user()?.id ?? null;
    if (me && itemId === me && this.teamForm.get('addSelf')?.value) {
      this.teamForm.get('addSelf')!.setValue(false, { emitEvent: false });
    }

    // w trybie edycji i jeśli to członek aktywny w DB -> oznacz go jako removed w backendzie
    if (this.editMode && this.currentTeamId && this.isDbActiveMember(itemId)) {
      this.partyService
        .removeMemberByTeamUser(this.currentTeamId, itemId)
        .subscribe({
          next: () => this.refreshMembersForEdit(),
          error: () => this.refreshMembersForEdit(),
        });
    }
  }

  // =========================
  // GM single-select helpers
  // =========================
  pickGm(userId: string | null): void {
    this.teamForm.get('gmId')?.setValue(userId);
  }

  selectedGmName(): string {
    const id = this.teamForm.get('gmId')?.value as string | null;
    if (!id) return '';
    const gm = this.gmsList().find((g) => g.userId === id);
    return gm ? this.gmDisplayName(gm) : '';
  }

  // =========================
  // Getters
  // =========================
  get systemControls(): FormArray {
    return this.teamForm.get('systems') as FormArray;
  }
  get membersControls(): FormArray {
    return this.teamForm.get('members') as FormArray;
  }
  get styleTagControls(): FormArray {
    return this.teamForm.get('styleTags') as FormArray;
  }

  // =========================
  // Pending actions
  // =========================
  acceptPending(memberLinkId: string): void {
    if (!this.currentTeamId) return;
    if (this.membersControls.length >= 5) return; // limit aktywnych

    // Jeżeli włączony tryb klubowy, to akceptować można tylko Member
    const pending = this.pendingMembers().find((p) => p.id === memberLinkId);
    if (pending && this.teamForm.get('isClubParty')?.value) {
      if (this.userCoworker(pending.userId) !== CoworkerRoles.Member) {
        this.openInfo(
          'Ta drużyna jest Tylko dla Klubowiczów – akceptować można wyłącznie Członków Klubu.'
        );
        return;
      }
    }

    this.partyService.acceptRequest(memberLinkId).subscribe({
      next: () => this.refreshMembersForEdit(),
      error: () => this.refreshMembersForEdit(),
    });
  }

  rejectPending(memberLinkId: string): void {
    if (!this.currentTeamId) return;
    this.partyService.rejectRequest(memberLinkId).subscribe({
      next: () => this.refreshMembersForEdit(),
      error: () => this.refreshMembersForEdit(),
    });
  }

  // =========================
  // Badge & display helpers
  // =========================
  userCoworker(userId: string): CoworkerRoles | null {
    const u =
      this.membersList().find((x) => x.id === userId) ??
      this.filteredMembers.find((x) => x.id === userId) ??
      null;
    return u?.coworker ?? null;
  }

  hasMemberBadge(userId: string): boolean {
    const u = this.getMemberById(userId);
    return u?.coworker === CoworkerRoles.Member;
  }
  hasGoldenBadge(userId: string): boolean {
    const u = this.getMemberById(userId);
    return u?.coworker === CoworkerRoles.Golden;
  }

  shouldShowEmailForActive(userId: string): boolean {
    return (
      this.canShowEmails() &&
      this.isDbActiveMember(userId) &&
      !!this.getUserEmailById(userId)
    );
  }

  shouldShowEmailForPending(userId: string): boolean {
    // pending rekordy mamy z backendu, więc jeśli właściciel – może widzieć mail
    return this.canShowEmails() && !!this.getUserEmailById(userId);
  }
  // =========================
  // Misc UI
  // =========================
  canShowEmails(): boolean {
    const me = this.user()?.id ?? null;
    return !!(
      this.editMode &&
      this.partyData &&
      me &&
      me === this.partyData.ownerId
    );
  }

  // zwróć samo imię/pseudonim (bez maila)
  getMemberNameById(memberId: string): string {
    const byId = (arr: IUser[]) => arr.find((u) => u.id === memberId);
    const full =
      byId(this.membersList()) ??
      byId(this.filteredMembers) ??
      (this.auth.user()?.id === memberId ? this.auth.user()! : null);
    return full ? this.getUserDisplayName(full) : memberId;
  }

  getUserEmailById(memberId: string): string {
    const byId = (arr: IUser[]) => arr.find((u) => u.id === memberId);
    const full =
      byId(this.membersList()) ??
      byId(this.filteredMembers) ??
      (this.auth.user()?.id === memberId ? this.auth.user()! : null);
    return full?.email ?? '';
  }

  getSystemNameById(systemId: string): string | undefined {
    const s = this.filteredSystems.find((x) => x.id === systemId);
    return s?.name;
  }

  getUserDisplayName(user: IUser | null): string {
    return this.auth.userDisplayName(user);
  }

  // =========================
  // Submit
  // =========================
  onSubmit(): void {
    if (!this.teamForm.valid) return;

    const teamData: IParty = {
      ...this.teamForm.value,
      slug: stringToSlug(this.teamForm.get('name')?.value),
    };

    const systems: string[] = this.systemControls.value;
    const styleTags: GmStyleTag[] = this.styleTagControls.value;
    const description: string = this.teamForm.get('description')?.value ?? '';
    const members: string[] = this.membersControls.value;

    // sprzątamy przed wysyłką
    delete (teamData as any).description;
    delete (teamData as any).systems;
    delete (teamData as any).styleTags;
    delete (teamData as any).members;
    delete (teamData as any).addSelf;

    this.partyService
      .createOrUpdateParty(teamData, systems, styleTags, description, members)
      .subscribe({
        next: () => {
          const tpl = this.partySuccessToast();
          if (tpl) {
            this.toastService.show({
              template: tpl,
              classname: 'bg-success text-white',
              header: `${this.modeMessage} drużynę!`,
            });
          }
          this.router.navigate(['/auth/my-parties']);
        },
        error: () => {
          const tpl = this.partyErrorToast();
          if (tpl) {
            this.toastService.show({
              template: tpl,
              classname: 'bg-danger text-white',
              header: `Nie udało się ${this.modeFailMessage} drużyny`,
            });
          }
        },
      });
  }

  // =========================
  // UI helpers
  // =========================
  get gmStyleTagValues(): GmStyleTag[] {
    return Object.values(GmStyleTag) as GmStyleTag[];
  }

  gmDisplayName(gm: IGmData): string {
    return this.gmService.gmDisplayName(gm);
  }

  isReceptionField(): boolean {
    if (!this.user) return false;
    return hasMinimumCoworkerRole(this.user(), CoworkerRoles.Reception);
  }

  toggleStyleTag(tag: GmStyleTag): void {
    const array = this.styleTagControls;
    const idx = array.value.indexOf(tag);
    if (idx === -1 && array.length < 3) array.push(this.fb.control(tag));
    else if (idx >= 0) array.removeAt(idx);
  }

  createButtonText(): string {
    return this.editMode ? 'Zapisz zmiany' : 'Utwórz drużynę';
  }

  isMemberSelected(id: string): boolean {
    return this.membersControls.value.includes(id);
  }

  toggleMember(id: string): void {
    // w trybie „Tylko dla Klubowiczów” nie pozwól dodać kogoś, kto nie jest Member
    if (
      this.teamForm.get('isClubParty')?.value &&
      this.userCoworker(id) !== CoworkerRoles.Member
    ) {
      this.openInfo(
        'Ta drużyna jest Tylko dla Klubowiczów – można dodawać wyłącznie Członków Klubu.'
      );
      return;
    }

    const ctrl = this.membersControls;
    const idx = ctrl.value.indexOf(id);
    if (idx >= 0) {
      ctrl.removeAt(idx);
      return;
    }
    if (ctrl.length >= 5) return;
    ctrl.push(this.fb.control(id));
  }

  getMemberById(memberId: string): IUser | null {
    return (
      this.membersList().find((u) => u.id === memberId) ??
      this.filteredMembers.find((u) => u.id === memberId) ??
      null
    );
  }
}
