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
import { NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { InfoModalComponent } from '../../../common/info-modal/info-modal.component';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';
import { PartyMemberStatus } from '../../../core/enums/party.enum';
import { CoworkerRoles } from '../../../core/enums/roles';
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
import { PartyService } from '../../core/services/party/party.service';

import { GmDirectoryService } from '../../core/services/gm/gm-directory/gm-directory.service';
import { GmPickerComponent } from './gm-picker/gm-picker.component';
import { PartyMembersPickerComponent } from './party-members-picker/party-members-picker.component';
import { StyleTagsComponent } from './style-tags/style-tags.component';
import { SystemsPickerComponent } from './systems-picker/systems-picker.component';

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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbDropdownModule,
    GmPickerComponent,
    SystemsPickerComponent,
    PartyMembersPickerComponent,
    StyleTagsComponent,
  ],
  templateUrl: './create-party.component.html',
  styleUrl: './create-party.component.scss',
})
export class CreatePartyComponent {
  readonly teamForm: FormGroup;
  private readonly fb = inject(FormBuilder);
  private readonly partyService = inject(PartyService);
  private readonly auth = inject(AuthService);
  private readonly backendService = inject(BackendService);
  private readonly gmDirectoryService = inject(GmDirectoryService);
  private readonly systemService = inject(SystemService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modal = inject(NgbModal);

  readonly CoworkerRoles = CoworkerRoles;
  readonly user = this.auth.user;

  readonly canSeeClubOnly = computed(() =>
    hasMinimumCoworkerRole(this.user(), CoworkerRoles.Member)
  );

  gmsList = signal<IGmData[]>([]);
  membersList = signal<IUser[]>([]);
  systemsList = computed(() => this.systemService.systems());

  readonly ownerDisplayName = computed(
    () => this.auth.userDisplayName(this.user()) ?? ''
  );

  GmStyleTag = GmStyleTag;
  GmStyleTagLabels = GmStyleTagLabels;

  allowedSystemIds: Set<string> | null = null;

  partySlug: string | null = null;
  editMode = false;
  partyData!: IParty;
  private currentTeamId: string | null = null;

  readonly pendingMembers = signal<{ id: string; userId: string }[]>([]);
  readonly dbActiveMemberIds = signal<Set<string>>(new Set());

  get modeMessage(): string {
    return this.editMode ? Modes.Edit : Modes.Create;
  }
  get modeFailMessage(): string {
    return this.editMode ? FailModes.Edit : FailModes.Create;
  }
  get modeSuccessMessage(): string {
    return this.editMode ? SuccessModes.Edit : SuccessModes.Create;
  }

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
      isClubParty: [false],
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

    this.gmDirectoryService.getAllGms().subscribe((gms) => this.gmsList.set(gms));

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
      .subscribe((users) => this.membersList.set(users));

    // Reakcja na zmianę GM – ograniczamy systemy i przycinamy niedozwolone
    this.teamForm
      .get('gmId')!
      .valueChanges.pipe(
        switchMap((gmId: string | null) =>
          gmId
            ? this.gmDirectoryService.getSystemsForGm(gmId)
            : of<IRPGSystem[] | null>(null)
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((systemsOrNull) => {
        this.allowedSystemIds = systemsOrNull
          ? new Set(systemsOrNull.map((s) => s.id))
          : null;
        if (this.allowedSystemIds)
          this.pruneSelectedSystems(this.allowedSystemIds);
      });

    const initialGm = this.teamForm.get('gmId')?.value as string | null;
    if (initialGm) {
      this.gmDirectoryService.getSystemsForGm(initialGm).subscribe((sys) => {
        this.allowedSystemIds = new Set(sys.map((s) => s.id));
        this.pruneSelectedSystems(this.allowedSystemIds!);
      });
    }

    // addSelf => utrzymujemy siebie na liście
    this.teamForm
      .get('addSelf')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked: boolean) => {
        if (checked) this.ensureSelfInMembers();
        else this.removeSelfFromMembers();
      });
  }

  // =========================
  // Wczytanie danych edycji
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

      this.refreshMembersForEdit();
    });
  }

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

        const activeIdsFromDb = Array.from(
          new Set(active.map((m) => m.userId).filter(Boolean) as string[])
        );
        this.dbActiveMemberIds.set(new Set(activeIdsFromDb));

        const current = new Set(this.membersControls.value as string[]);
        const merged = Array.from(
          new Set([...activeIdsFromDb, ...current])
        ).slice(0, 5);
        this.setFormArray(this.membersControls, merged);

        const me = this.auth.user()?.id ?? null;
        const hasMe = !!me && merged.includes(me);
        this.teamForm.get('addSelf')!.setValue(hasMe, { emitEvent: false });

        this.pendingMembers.set(
          pending.map((p) => ({ id: p.id, userId: p.userId }))
        );
      });
  }

  // =========================
  // Club-only toggle
  // =========================
  onClubOnlyToggle(isClub: boolean): void {
    if (isClub) {
      const nonClubPresent = (this.membersControls.value as string[]).some(
        (id) => this.userCoworker(id) !== CoworkerRoles.Member
      );
      if (nonClubPresent) {
        this.openInfo(
          'Przed ustawieniem drużyny "Tylko dla Klubowiczów" usuń z drużyny wszystkie osoby, niebędące Członkami Klubu Gier Fabularnych!'
        );
        this.teamForm.get('isClubParty')!.setValue(false, { emitEvent: false });
        return;
      }
    }
  }

  private openInfo(message: string): void {
    const ref = this.modal.open(InfoModalComponent, { backdrop: 'static' });
    ref.componentInstance.header = 'Informacja';
    ref.componentInstance.message = message;
    ref.componentInstance.showCancel = false;
  }

  // =========================
  // Helpers (members)
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

  userCoworker(userId: string): CoworkerRoles | null {
    const u = this.membersList().find((x) => x.id === userId) ?? null;
    return u?.coworker ?? null;
  }

  // =========================
  // Systems helpers
  // =========================
  private pruneSelectedSystems(allowed: Set<string>): void {
    const ctrl = this.systemControls;
    for (let i = ctrl.length - 1; i >= 0; i--) {
      const id = ctrl.at(i).value;
      if (!allowed.has(id)) ctrl.removeAt(i);
    }
  }

  // =========================
  // Pending actions
  // =========================
  acceptPending(memberLinkId: string): void {
    if (!this.currentTeamId) return;
    if (this.membersControls.length >= 5) return;

    const pending = this.pendingMembers().find((p) => p.id === memberLinkId);
    if (pending && this.teamForm.get('isClubParty')?.value) {
      const u = this.membersList().find((x) => x.id === pending.userId);
      if (u?.coworker !== CoworkerRoles.Member) {
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

  onRemoveDbActive(userId: string): void {
    if (this.editMode && this.currentTeamId && this.isDbActiveMember(userId)) {
      this.partyService
        .removeMemberByTeamUser(this.currentTeamId, userId)
        .subscribe({
          next: () => this.refreshMembersForEdit(),
          error: () => this.refreshMembersForEdit(),
        });
    }
  }

  // =========================
  // Handlery dla childów
  // =========================
  onGmChange(userId: string | null) {
    this.teamForm.get('gmId')?.setValue(userId);
  }

  onMembersChange(newIds: string[]) {
    this.setFormArray(this.membersControls, newIds.slice(0, 5));
    const me = this.auth.user()?.id ?? null;
    const hasMe = !!me && newIds.includes(me);
    this.teamForm.get('addSelf')!.setValue(hasMe, { emitEvent: false });
  }

  onSystemsChange(newIds: string[]) {
    this.setFormArray(this.systemControls, newIds.slice(0, 5));
  }

  onStylesChange(newTags: GmStyleTag[]) {
    this.setFormArray(
      this.styleTagControls,
      newTags.slice(0, 3) as unknown as string[]
    );
  }

  onNonClubAttempt() {
    this.openInfo(
      'Ta drużyna jest Tylko dla Klubowiczów – można dodawać wyłącznie Członków Klubu.'
    );
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
}
