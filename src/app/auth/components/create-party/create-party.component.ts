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
import { switchMap, map } from 'rxjs/operators';

import { FilterOperator } from '../../../core/enums/filterOperator';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';
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
import { GmService } from '../../core/services/gm/gm.service';
import { PartyService } from '../../core/services/party/party.service';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

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

  readonly CoworkerRoles = CoworkerRoles;
  readonly user = this.auth.user;

  // dane list
  gmsList = signal<IGmData[]>([]);
  membersList = signal<IUser[]>([]);
  systemsList = computed(() => this.systemService.systems());

  // labelki
  GmStyleTag = GmStyleTag;
  GmStyleTagLabels = GmStyleTagLabels;

  // filtry UI
  filteredSystems: IRPGSystem[] = [];
  filteredMembers: IUser[] = [];
  filteredGms: IGmData[] = [];

  // ograniczenia systemów dla wybranego MG
  private allowedSystemIds: Set<string> | null = null;
  private lastSystemsSearchTerm = '';

  // stan edycji
  partySlug: string | null = null;
  editMode = false;
  partyData!: IParty;

  modeMessage = this.editMode ? Modes.Edit : Modes.Create;
  modeFailMessage = this.editMode ? FailModes.Edit : FailModes.Create;
  modeSuccessMessage = this.editMode ? SuccessModes.Edit : SuccessModes.Create;

  // wyszukiwarki
  systemsSearchTerm$ = new BehaviorSubject<string>('');
  membersSearchTerm$ = new BehaviorSubject<string>('');
  gmSearchTerm$ = new BehaviorSubject<string>('');

  // toasty
  readonly partySuccessToast = viewChild<TemplateRef<unknown>>('partySuccessToast');
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
    });

    this.systemService.loadAvailableSystems();

    this.route.data.subscribe((data) => {
      if (data['party']) {
        this.partyData = data['party'];
        this.partySlug = this.partyData.slug;
        this.editMode = true;
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

    // members list
    this.backendService
      .getAll<IUser>('users', 'firstName', 'asc', {
        filters: {
          coworker: {
            value: [CoworkerRoles.Member, CoworkerRoles.User, CoworkerRoles.Golden],
            operator: FilterOperator.IN,
          },
        },
      })
      .subscribe((users) => {
        this.membersList.set(users);
        this.filteredMembers = this.membersList();
      });

    // systems (na start pełna lista)
    this.applySystemFilter('');

    // checkbox "dodaj mnie"
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
      .subscribe((term) => this.filterItems(term, 'members'));

    this.gmSearchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.filterItems(term, 'gms'));

    // zmiana MG -> pobierz systemy MG i nałóż ograniczenie
    this.teamForm
      .get('gmId')!
      .valueChanges.pipe(
        switchMap((gmId: string | null) =>
          gmId ? this.gmService.getSystemsForGm(gmId) : of<IRPGSystem[] | null>(null)
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((systemsOrNull) => {
        this.allowedSystemIds = systemsOrNull ? new Set(systemsOrNull.map((s) => s.id)) : null;
        // odśwież filtr listy
        this.applySystemFilter(this.lastSystemsSearchTerm);
        // i przytnij wybrane systemy (jeśli trzeba)
        if (this.allowedSystemIds) this.pruneSelectedSystems(this.allowedSystemIds);
      });

    // inicjalne ograniczenie wg domyślnego gmId (np. podczas edycji)
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

      this.teamForm.patchValue({
        name: party.name,
        gmId: party.gmId,
        beginnersProgram: party.beginnersProgram,
        programStage: party.programStage,
        notes: party.notes,
        isOpen: party.isOpen,
        isForBeginners: party.isForBeginners,
      });

      forkJoin([
        this.partyService.getPartyProfile(party.id),
        this.partyService.getPartySystems(party.id),
        this.partyService.getPartyMembers(party.id),
      ]).subscribe(([profile, systems, members]) => {
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
          systems.forEach((s) => this.systemControls.push(this.fb.control(s.id)));
        }

        if (members) {
          members.forEach((m) => this.membersControls.push(this.fb.control(m.userId)));
          const me = this.auth.user()?.id ?? null;
          const hasMe = !!me && !!members.find((m) => m.userId === me);
          this.teamForm.get('addSelf')!.setValue(hasMe, { emitEvent: false });
        }
      });
    });
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
      const src = this.membersList();
      this.filteredMembers =
        term.length >= 3
          ? src.filter((m) =>
              `${this.getUserDisplayName(m)} ${m.email}`.toLowerCase().includes(term.toLowerCase())
            )
          : src;
    } else {
      const src = this.gmsList();
      this.filteredGms =
        term.length >= 3
          ? src.filter((g) => this.gmDisplayName(g).toLowerCase().includes(term.toLowerCase()))
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

    const selectedValues = Array.from(target.selectedOptions).map((o) => o.value);
    const controls = type === 'systems' ? this.systemControls : this.membersControls;

    selectedValues.forEach((id) => {
      if (controls.value.length < 5 && !controls.value.includes(id)) {
        controls.push(this.fb.control(id));
      }
    });
  }

  removeItem(itemId: string, type: 'systems' | 'members'): void {
    const controls = type === 'systems' ? this.systemControls : this.membersControls;
    const i = controls.value.indexOf(itemId);
    if (i >= 0) controls.removeAt(i);
  }

  // =========================
  // GM single-select helpers
  // =========================
  pickGm(userId: string | null): void {
    this.teamForm.get('gmId')?.setValue(userId);
    // reszta (pobranie systemów, filtr, prune) odbywa się w subskrypcji valueChanges
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

  getMemberNameById(memberId: string): string {
    const byId = (arr: IUser[]) => arr.find((u) => u.id === memberId);
    const full = byId(this.membersList()) ?? byId(this.filteredMembers) ?? null;
    if (full) return `${this.getUserDisplayName(full)} ${full.email}`;
    if (this.auth.user()?.id === memberId) {
      const me = this.auth.user()!;
      return `${this.getUserDisplayName(me)} ${me.email}`;
    }
    return memberId;
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

  // members dropdown helpers
  isMemberSelected(id: string): boolean {
    return this.membersControls.value.includes(id);
  }

  toggleMember(id: string): void {
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
