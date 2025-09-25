import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  TemplateRef,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import { CoworkerDirectoryService } from '../../core/services/coworker-directory/coworker-directory.service';
import { AuthService } from '../../../core/services/auth/auth.service';

import { IUser } from '../../../core/interfaces/i-user';
import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';
import {
  hasMinimumCoworkerRole,
  hasMinimumSystemRole,
  hasStrictCoworkerRole,
} from '../../../core/utils/required-roles';

import { FilterOperator } from '../../../core/enums/filterOperator';
import { ToastService } from '../../../core/services/toast/toast.service';
import { BackendService } from '../../../core/services/backend/backend.service';

@Component({
  selector: 'app-coworker-personal-files',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDropdownModule],
  templateUrl: './coworker-personal-files.component.html',
  styleUrls: ['./coworker-personal-files.component.scss'],
})
export class CoworkerPersonalFilesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly backend = inject(BackendService);
  private readonly dir = inject(CoworkerDirectoryService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  // --- uprawnienia ---
  readonly currentUser = computed(() => this.auth.user());
  // dostęp do modułu – min. GM (jak ustaliłeś wcześniej)
  readonly isAllowed = computed(() =>
    hasMinimumCoworkerRole(this.currentUser(), CoworkerRoles.Gm)
  );
  // picker tylko dla Ownera lub Admina
  readonly canPickOthers = computed(
    () =>
      hasMinimumSystemRole(this.currentUser(), SystemRole.Admin) ||
      hasStrictCoworkerRole(this.currentUser(), CoworkerRoles.Owner)
  );

  displayNick(u: IUser | null | undefined): string {
    if (!u) return '—';
    return u.nickname && u.useNickname
      ? u.nickname
      : u.firstName || u.email || '—';
  }

  roleBadgeClass(role?: CoworkerRoles): string {
    switch (role) {
      case CoworkerRoles.Gm:
        return 'tag-badge gm';
      case CoworkerRoles.Reception:
        return 'tag-badge reception';
      case CoworkerRoles.Coowner:
        return 'tag-badge coowner';
      case CoworkerRoles.Owner:
        return 'tag-badge owner';
      default:
        return 'tag-badge muted';
    }
  }
  // --- stan i formularz ---
  readonly selectedUser = signal<IUser | null>(null);
  readonly loading = signal(false);

  readonly form = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    nickname: [''],

    // pola wyłączone (na przyszłość)
    phoneNumber: [{ value: '', disabled: true }],
    city: [{ value: '', disabled: true }],
    street: [{ value: '', disabled: true }],
    houseNumber: [{ value: '', disabled: true }],
    apartmentNumber: [{ value: '', disabled: true }],
    postalCode: [{ value: '', disabled: true }],
    pesel: [{ value: '', disabled: true }],
    iban: [{ value: '', disabled: true }],
    nfzBranch: [{ value: '', disabled: true }],
    taxOfficeName: [{ value: '', disabled: true }],
    taxOfficeCity: [{ value: '', disabled: true }],
  });

  readonly canSaveSig = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map(
        () =>
          !!this.selectedUser() &&
          this.form.get('firstName')!.valid &&
          this.form.get('lastName')!.valid
      )
    ),
    { initialValue: false }
  );

  // --- lista użytkowników do dropdowna (GM+) – tylko gdy canPickOthers() === true ---
  // Filtrowanie: coworker IN [Gm, Reception, Coordinator, Coowner, Owner] i is_test_user=false
  readonly gmPlusList = toSignal(
    this.backend
      .getAll<IUser>('users', 'firstName', 'asc', {
        filters: {
          coworker: {
            operator: FilterOperator.IN,
            value: [
              CoworkerRoles.Gm,
              CoworkerRoles.Reception,
              CoworkerRoles.Coordinator,
              CoworkerRoles.Coowner,
              CoworkerRoles.Owner,
            ],
          },
          isTestUser: { operator: FilterOperator.EQ, value: false },
        },
      })
      .pipe(
        map((list) => {
          // sort: nazwisko, imię, email – z fallbackami
          return [...list].sort((a, b) => {
            const aLast = (a as any).lastName ?? '';
            const bLast = (b as any).lastName ?? '';
            const c1 = String(aLast).localeCompare(String(bLast));
            if (c1) return c1;
            const c2 = String(a.firstName ?? '').localeCompare(
              String(b.firstName ?? '')
            );
            if (c2) return c2;
            return String(a.email ?? '').localeCompare(String(b.email ?? ''));
          });
        }),
        catchError(() => of([] as IUser[]))
      ),
    { initialValue: [] as IUser[] }
  );

  // --- toasty ---
  readonly saveSuccessToast =
    viewChild<TemplateRef<unknown>>('saveSuccessToast');
  readonly saveErrorToast = viewChild<TemplateRef<unknown>>('saveErrorToast');

  ngOnInit(): void {
    // Jeżeli nie możesz wybierać innych – wczytaj siebie i pokaż formularz bez picker’a
    if (this.isAllowed() && !this.canPickOthers()) {
      const me = this.currentUser();
      if (me) {
        this.applySelectedUser(me);
      }
    }
  }

  // Wybranie użytkownika z dropdowna
  pickUser(u: IUser) {
    if (!this.canPickOthers()) return;
    this.applySelectedUser(u);
  }

  private applySelectedUser(u: IUser) {
    this.selectedUser.set(u);
    this.form.patchValue({
      firstName: u.firstName ?? '',
      lastName: (u as any).lastName ?? '',
      nickname: u.nickname ?? '',
    });
  }

  // zapis do coworkers_public
  readonly saving = signal(false);

  save() {
    if (!this.isAllowed() || !this.canSaveSig()) return;
    const u = this.selectedUser();
    if (!u) return;

    this.saving.set(true);

    const payload = {
      userId: u.id,
      firstName: (this.form.get('firstName')!.value ?? '').trim(),
      lastName: (this.form.get('lastName')!.value ?? '').trim(),
      displayName: (this.form.get('nickname')!.value ?? '').trim() || null,
    };

    this.dir.upsert(payload).subscribe({
      next: () => {
        this.saving.set(false);
        const t = this.saveSuccessToast();
        if (t) {
          this.toast.show({
            template: t,
            classname: 'bg-success text-white',
            header: 'Zapisano!',
          });
        }
      },
      error: () => {
        this.saving.set(false);
        const t = this.saveErrorToast();
        if (t) {
          this.toast.show({
            template: t,
            classname: 'bg-danger text-white',
            header: 'Błąd zapisu',
          });
        }
      },
    });
  }
}
