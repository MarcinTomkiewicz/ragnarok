import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormArray,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TeamService } from '../../core/services/team/team.service';
import { maxThreeStyles } from '../../../core/utils/tag-limiter';
import { SystemService } from '../../../core/services/system/system.service';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';
import { AuthService } from '../../../core/services/auth/auth.service';
import { GmService } from '../../core/services/gm/gm.service';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';
import { CoworkerRoles } from '../../../core/enums/roles';
import { BehaviorSubject, debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ITeamMember } from '../../../core/interfaces/teams/i-team-member';
import { stringToSlug } from '../../../core/utils/type-mappers';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-create-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-team.component.html',
  styleUrl: './create-team.component.scss',
})
export class CreateTeamComponent {
  readonly teamForm: FormGroup;
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly gmService = inject(GmService);
  private readonly systemService = inject(SystemService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly user = this.auth.user;
  gmsList = signal<IGmData[]>([]);

  systemsList = computed(() => this.systemService.systems());
  GmStyleTag = GmStyleTag;
  GmStyleTagLabels = GmStyleTagLabels;
  filteredSystems: IRPGSystem[] = [];

  searchTerm$: BehaviorSubject<string> = new BehaviorSubject('');
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
      systems: this.fb.array([]),
      styleTags: this.fb.array([], maxThreeStyles),
      isOpen: [true],
      isForBeginners: [false],
    });

    this.systemService.loadAvailableSystems();
  }

  ngOnInit(): void {
    this.gmService.getAllGms().subscribe((gms) => {
      this.gmsList.set(gms);
    });

    this.filteredSystems = this.systemsList();

    // Subscribe to search term with debounce
    this.searchTerm$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.filterSystems(term));
  }

  filterSystems(term: string): void {
    if (term.length >= 3) {
      this.filteredSystems = this.systemsList().filter((system) =>
        system.name.toLowerCase().includes(term.toLowerCase())
      );
    } else {
      this.filteredSystems = this.systemsList(); // Reset results if less than 3 characters
    }
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm$.next(input.value); // Emit new search term to trigger filtering
  }

  // Funkcja pomocnicza do wyświetlania nazw tagów
  get gmStyleTagValues(): GmStyleTag[] {
    return Object.values(GmStyleTag) as GmStyleTag[];
  }

  isReceptionField(): boolean {
    if (!this.user) return false;
    return hasMinimumCoworkerRole(this.user(), CoworkerRoles.Reception);
  }

  get systemControls(): FormArray {
    return this.teamForm.get('systems') as FormArray;
  }

  get styleTagControls(): FormArray {
    return this.teamForm.get('styleTags') as FormArray;
  }

  onSystemChange(event: Event): void {
    const selectedValues = Array.from(
      (event.target as HTMLSelectElement).selectedOptions
    ).map((option) => option.value); // Pobieramy wartości wybranych systemów

    selectedValues.forEach((systemId) => {
      if (
        this.systemControls.value.length < 5 &&
        !this.systemControls.value.includes(systemId)
      ) {
        this.systemControls.push(this.fb.control(systemId));
      }
    });
  }

  getSystemNameById(systemId: string): string | undefined {
    const system = this.systemsList().find((s) => s.id === systemId);
    return system?.name;
  }

  removeSystem(systemId: string): void {
    const systems = this.systemControls.controls;
    const index = systems.findIndex((ctrl) => ctrl.value === systemId);
    if (index > -1) {
      this.systemControls.removeAt(index);
    }
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

  onSubmit() {
    if (this.teamForm.valid) {
      const teamData = {
        ...this.teamForm.value,
        slug: stringToSlug(this.teamForm.get('name')?.value),
      };
      const systems = this.systemControls.value;
      const styleTags = this.styleTagControls.value;
      const description = teamData.description;
      const members: ITeamMember[] = [];

      delete teamData.description;
      delete teamData.systems;
      delete teamData.styleTags;

      // Wysyłamy dane do serwisu
      this.teamService
        .createTeam(teamData, systems, styleTags, description, members)
        .subscribe({
          next: (team) => {
            const template = this.partySuccessToast();
            if (template) {
              this.toastService.show({
                template,
                classname: 'bg-success text-white',
                header: 'Utworzono drużynę!',
              });
            }
            this.router.navigate(['/auth/my-teams']);
          },
          error: () => {
            const template = this.partyErrorToast();
            if (template) {
              this.toastService.show({
                template,
                classname: 'bg-danger text-white',
                header: 'Nie udało się utworzyć drużyny',
              });
            }
          },
        });
    }
  }
}
