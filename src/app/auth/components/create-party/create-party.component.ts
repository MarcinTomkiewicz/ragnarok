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
import { Router } from '@angular/router';
import { BehaviorSubject, debounceTime } from 'rxjs';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';
import { CoworkerRoles } from '../../../core/enums/roles';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IUser } from '../../../core/interfaces/i-user';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { SystemService } from '../../../core/services/system/system.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';
import { maxThreeStyles } from '../../../core/utils/tag-limiter';
import { stringToSlug } from '../../../core/utils/type-mappers';
import { GmService } from '../../core/services/gm/gm.service';
import { PartyService } from '../../core/services/party/party.service';

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
  Create = 'utworzona'
}

@Component({
  selector: 'app-create-party',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  readonly user = this.auth.user;
  gmsList = signal<IGmData[]>([]);
  membersList = signal<IUser[]>([]);

  systemsList = computed(() => this.systemService.systems());
  GmStyleTag = GmStyleTag;
  GmStyleTagLabels = GmStyleTagLabels;
  filteredSystems: IRPGSystem[] = [];
  filteredMembers: IUser[] = [];

  editMode = false;
  partyId: string | null = null;
  modeMessage = this.editMode ? Modes.Edit : Modes.Create;
  modeFailMessage = this.editMode ? FailModes.Edit : FailModes.Create;
  modeSuccessMessage = this.editMode ? SuccessModes.Edit : SuccessModes.Create;

  systemsSearchTerm$: BehaviorSubject<string> = new BehaviorSubject('');
  membersSearchTerm$: BehaviorSubject<string> = new BehaviorSubject('');
  private destroyRef = inject(DestroyRef);

  readonly partySuccessToast =
    viewChild<TemplateRef<unknown>>('partySuccessToast');
  readonly partyErrorToast = viewChild<TemplateRef<unknown>>('partyErrorToast');

  constructor() {
    this.teamForm = this.fb.group({
      name: ['', Validators.required],
      gmId: [null],
      description: [''],
      startProgram: [false],
      finishedProgram: [false],
      notes: [''],
      members: this.fb.array([]),
      systems: this.fb.array([]),
      styleTags: this.fb.array([], maxThreeStyles),
      isOpen: [true],
      isForBeginners: [false],
    });

    this.systemService.loadAvailableSystems();
  }

  ngOnInit(): void {
    if (this.editMode && this.partyId) {
      this.loadPartyData();
    }

    this.gmService.getAllGms().subscribe((gms) => {
      this.gmsList.set(gms);
    });

    this.backendService
      .getAll<IUser>('users', 'firstName', 'asc', {
        filters: {
          coworker: {
            value: CoworkerRoles.Member,
            operator: FilterOperator.EQ,
          },
        },
      })
      .subscribe((users) => {
        this.membersList.set(users);
      });

    if (this.partyId) {
      this.editMode = true;
      this.loadPartyData();
    }

    this.systemsSearchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.filterItems(term, 'systems');
      });

    this.membersSearchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.filterItems(term, 'members');
      });
  }

  loadPartyData(): void {
    if (!this.partyId) return;

    this.partyService.getPartyById(this.partyId).subscribe((party) => {
      if (party) {
        // Wypełniamy dane drużyny
        this.teamForm.patchValue({
          name: party.name,
          gmId: party.gmId,
          startProgram: party.startProgram,
          finishedProgram: party.finishedProgram,
          notes: party.notes,
          isOpen: party.isOpen,
          isForBeginners: party.isForBeginners,
        });

        // Wczytujemy profil drużyny
        this.partyService.getPartyProfile(party.id).subscribe((profile) => {
          if (profile) {
            this.teamForm.patchValue({
              description: profile.description,
              styleTags: profile.styleTags,
            });
          }
        });

        // Wczytujemy systemy drużyny
        this.partyService.getPartySystems(party.id).subscribe((systems) => {
          systems.forEach((system) => {
            this.systemControls.push(this.fb.control(system.id));
          });
        });

        // Wczytujemy członków drużyny
        this.partyService.getPartyMembers(party.id).subscribe((members) => {
          members.forEach((member) => {
            this.membersControls.push(this.fb.control(member.userId));
          });
        });
      }
    });
  }

  onSearchChange(event: Event, type: 'systems' | 'members'): void {
    const input = event.target as HTMLInputElement;
    if (type === 'systems') {
      this.systemsSearchTerm$.next(input.value);
    } else if (type === 'members') {
      this.membersSearchTerm$.next(input.value);
    }
  }

  filterItems(term: string, type: 'systems' | 'members'): void {
    if (term.length >= 3) {
      if (type === 'systems') {
        this.filteredSystems = this.systemsList().filter((system) =>
          system.name.toLowerCase().includes(term.toLowerCase())
        );
      } else if (type === 'members') {
        this.filteredMembers = this.membersList().filter((member) =>
          `${member.firstName} ${member.email}`
            .toLowerCase()
            .includes(term.toLowerCase())
        );
      }
    } else {
      if (type === 'systems') {
        this.filteredSystems = this.systemsList();
      } else if (type === 'members') {
        this.filteredMembers = this.membersList();
      }
    }
  }

  onItemChange(event: Event, type: 'systems' | 'members'): void {
    const target = event.target as HTMLSelectElement;

    // Sprawdzenie, czy target jest poprawnym HTMLSelectElement i zawiera selectedOptions
    if (target && target.selectedOptions) {
      const selectedValues = Array.from(target.selectedOptions).map(
        (option) => option.value
      );

      const controls =
        type === 'systems' ? this.systemControls : this.membersControls;

      selectedValues.forEach((id) => {
        // Dodajemy nowego członka/system, jeżeli nie przekraczamy limitu 5
        if (controls.value.length < 5 && !controls.value.includes(id)) {
          controls.push(this.fb.control(id));
        }
      });
    }
  }

  // Generic method to remove items from system or members
  removeItem(itemId: string, type: 'systems' | 'members'): void {
    const controls =
      type === 'systems' ? this.systemControls : this.membersControls;
    const index = controls.value.indexOf(itemId);
    if (index >= 0) {
      controls.removeAt(index);
    }
  }

  // Getters for FormArrays
  get systemControls(): FormArray {
    return this.teamForm.get('systems') as FormArray;
  }

  get membersControls(): FormArray {
    return this.teamForm.get('members') as FormArray;
  }

  getMemberNameById(memberId: string): string | undefined {
    const member = this.filteredMembers.find((m) => m.id === memberId);
    return member ? `${member.firstName} ${member.email}` : '';
  }

  // Pobieranie nazwy systemu
  getSystemNameById(systemId: string): string | undefined {
    const system = this.filteredSystems.find((s) => s.id === systemId);
    return system?.name;
  }

  // Submit form method
  onSubmit(): void {
    if (this.teamForm.valid) {
      const teamData = {
        ...this.teamForm.value,
        slug: stringToSlug(this.teamForm.get('name')?.value),
      };
      const systems = this.systemControls.value;
      const styleTags = this.styleTagControls.value;
      const description = teamData.description;
      const members = this.teamForm.value.members;

      delete teamData.description;
      delete teamData.systems;
      delete teamData.styleTags;
      delete teamData.members;

      // if (this.editMode && this.partyId) {
      //   // Jeśli edytujemy, wywołujemy updateParty
      //   this.partyService.updateParty(this.partyId, teamData).subscribe({
      //     next: (team) => {
      //       const template = this.partySuccessToast();
      //       if (template) {
      //         this.toastService.show({
      //           template,
      //           classname: 'bg-success text-white',
      //           header: 'Zaktualizowano drużynę!',
      //         });
      //       }
      //       this.router.navigate(['/auth/my-teams']);
      //     },
      //     error: () => {
      //       const template = this.partyErrorToast();
      //       if (template) {
      //         this.toastService.show({
      //           template,
      //           classname: 'bg-danger text-white',
      //           header: 'Nie udało się zaktualizować drużyny',
      //         });
      //       }
      //     },
      //   });
      // } else {

      this.partyService
        .createOrUpdateParty(teamData, systems, styleTags, description, members)
        .subscribe({
          next: (team) => {
            const template = this.partySuccessToast();
            if (template) {
              this.toastService.show({
                template,
                classname: 'bg-success text-white',
                header: `${this.modeMessage} drużynę!`,
              });
            }
            this.router.navigate(['/auth/my-parties']);
          },
          error: () => {
            const template = this.partyErrorToast();
            if (template) {
              this.toastService.show({
                template,
                classname: 'bg-danger text-white',
                header: `Nie udało się ${this.modeFailMessage} drużyny`,
              });
            }
          },
        });
    }
  }

  // Additional utility functions for style tags and members
  get gmStyleTagValues(): GmStyleTag[] {
    return Object.values(GmStyleTag) as GmStyleTag[];
  }

  isReceptionField(): boolean {
    if (!this.user) return false;
    return hasMinimumCoworkerRole(this.user(), CoworkerRoles.Reception);
  }

  toggleStyleTag(tag: GmStyleTag): void {
    const array = this.styleTagControls;
    const idx = array.value.indexOf(tag);

    if (idx === -1 && array.length < 3) {
      array.push(this.fb.control(tag));
    } else if (idx >= 0) {
      array.removeAt(idx);
    }
  }

  get styleTagControls(): FormArray {
    return this.teamForm.get('styleTags') as FormArray;
  }
}
