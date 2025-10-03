import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  TemplateRef,
  DestroyRef,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal, toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import { CoworkerDirectoryService } from '../../core/services/coworker-directory/coworker-directory.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { BackendService } from '../../../core/services/backend/backend.service';

import { IUser } from '../../../core/interfaces/i-user';
import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';
import {
  hasMinimumCoworkerRole,
  hasMinimumSystemRole,
  hasStrictCoworkerRole,
} from '../../../core/utils/required-roles';
import { FilterOperator } from '../../../core/enums/filterOperator';

// Rekord w tabeli coworkers_public
export interface ICoworkerPublic {
  userId: string; // auth.users.id
  firstName: string;
  lastName: string;
  displayName?: string | null;
}

@Component({
  selector: 'app-coworker-personal-files',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDropdownModule],
  templateUrl: './coworker-personal-files.component.html',
  styleUrls: ['./coworker-personal-files.component.scss'],
})
export class CoworkerPersonalFilesComponent implements OnInit {
  // --- serwisy ---
  private readonly formBuilder = inject(FormBuilder);
  private readonly backendService = inject(BackendService);
  private readonly coworkerDirectoryService = inject(CoworkerDirectoryService); // do upsert
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // --- uprawnienia / bieżący użytkownik ---
  readonly currentUser = computed(() => this.authService.user());
  readonly isAccessAllowed = computed(() =>
    hasMinimumCoworkerRole(this.currentUser(), CoworkerRoles.Gm)
  );
  readonly canPickOtherUsers = computed(
    () =>
      hasMinimumSystemRole(this.currentUser(), SystemRole.Admin) ||
      hasStrictCoworkerRole(this.currentUser(), CoworkerRoles.Owner)
  );

  // --- stan i formularz ---
  readonly selectedUser = signal<IUser | null>(null);
  readonly loading = signal(false);

  readonly form = this.formBuilder.group({
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

  // --- konwersje signal→observable (UWAGA: w polach, nie w ngOnInit) ---
  private readonly selectedUser$ = toObservable(this.selectedUser);
  private readonly canPickOthers$ = toObservable(this.canPickOtherUsers);

  private readonly selectedUserId$ = this.selectedUser$.pipe(
    map(u => u?.id ?? null),
    startWith(null),
    distinctUntilChanged()
  );

  // tylko jeśli admin/owner — pobieramy GM+; dla GM => []
  readonly gmPlusUsersList = toSignal(
    this.canPickOthers$.pipe(
      startWith(this.canPickOtherUsers()),
      switchMap(allowed => {
        if (!allowed) return of([] as IUser[]);
        return this.backendService
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
            map(list =>
              [...list].sort((a, b) => {
                const aLast = (a as any).lastName ?? '';
                const bLast = (b as any).lastName ?? '';
                const c1 = String(aLast).localeCompare(String(bLast));
                if (c1) return c1;
                const c2 = String(a.firstName ?? '').localeCompare(String(b.firstName ?? ''));
                if (c2) return c2;
                return String(a.email ?? '').localeCompare(String(b.email ?? ''));
              })
            ),
            catchError(() => of([] as IUser[]))
          );
      })
    ),
    { initialValue: [] as IUser[] }
  );

  // canSave zależne od stanu form i tego czy user wybrany
  readonly canSaveSig = toSignal(
    combineLatest([
      this.form.statusChanges.pipe(startWith(this.form.status)),
      this.selectedUser$.pipe(startWith(this.selectedUser())),
    ]).pipe(
      map(([_, sel]) =>
        !!sel &&
        this.form.get('firstName')!.valid &&
        this.form.get('lastName')!.valid
      )
    ),
    { initialValue: false }
  );

  // --- toasty ---
  readonly saveSuccessToast = viewChild<TemplateRef<unknown>>('saveSuccessToast');
  readonly saveErrorToast = viewChild<TemplateRef<unknown>>('saveErrorToast');

  // -------------------- lifecycle --------------------
  ngOnInit(): void {
    // Subskrypcja patchowania formularza: dla KAŻDEJ zmiany selectedUser dociągamy TYLKO jego rekord z coworkers_public
    this.selectedUserId$
      .pipe(
        switchMap(userId => {
          if (!userId) return of(null as ICoworkerPublic | null);
          return this.backendService
            .getOneByFields<ICoworkerPublic>('coworkers_public', { userId })
            .pipe(catchError(() => of(null as ICoworkerPublic | null)));
        }),
        tap(official => this.patchFormFromData(official)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // Jeśli nie możesz wybierać innych – ustaw siebie jako selected
    if (this.isAccessAllowed() && !this.canPickOtherUsers()) {
      const me = this.currentUser();
      if (me) this.applySelectedUser(me);
    }
  }

  // -------------------- UI helpers --------------------
  displayNick(u: IUser | null | undefined): string {
    if (!u) return '—';
    return u.nickname && u.useNickname ? u.nickname : (u.firstName || u.email || '—');
  }

  roleBadgeClass(role?: CoworkerRoles): string {
    switch (role) {
      case CoworkerRoles.Gm: return 'tag-badge gm';
      case CoworkerRoles.Reception: return 'tag-badge reception';
      case CoworkerRoles.Coowner: return 'tag-badge coowner';
      case CoworkerRoles.Owner: return 'tag-badge owner';
      default: return 'tag-badge muted';
    }
  }

  // -------------------- UI handlers --------------------
  pickUser(u: IUser) {
    if (!this.canPickOtherUsers()) return;
    this.applySelectedUser(u);
  }

  private applySelectedUser(u: IUser) {
    this.selectedUser.set(u);
    // patch zrobi subskrypcja selectedUserId$ → getOneByFields(...)
  }

  // Patch formularza bez nadpisywania niepustych pól pustkami
  private patchFormFromData(official: ICoworkerPublic | null) {
    const u = this.selectedUser();
    if (!u) return;

    const incomingFirst = (official?.firstName ?? u.firstName ?? '').trim();
    const incomingLast  = (official?.lastName  ?? (u as any)?.lastName ?? '').trim();
    const incomingNick  = (official?.displayName ?? u.nickname ?? '').trim();

    const keepIfIncomingEmpty = (ctrl: 'firstName'|'lastName'|'nickname', incoming: string) => {
      const current = (this.form.get(ctrl)!.value ?? '').trim();
      return incoming === '' && current !== '' ? current : incoming;
    };

    const nextFirst = keepIfIncomingEmpty('firstName', incomingFirst);
    const nextLast  = keepIfIncomingEmpty('lastName',  incomingLast);
    const nextNick  = keepIfIncomingEmpty('nickname',  incomingNick);

    const curFirst = (this.form.get('firstName')!.value ?? '').trim();
    const curLast  = (this.form.get('lastName')!.value ?? '').trim();
    const curNick  = (this.form.get('nickname')!.value ?? '').trim();

    const patch: any = {};
    let need = false;
    if (curFirst !== nextFirst) { patch.firstName = nextFirst; need = true; }
    if (curLast  !== nextLast)  { patch.lastName  = nextLast;  need = true; }
    if (curNick  !== nextNick)  { patch.nickname  = nextNick;  need = true; }

    if (need) this.form.patchValue(patch, { emitEvent: false });
  }

  // -------------------- zapis do coworkers_public --------------------
  readonly saving = signal(false);

  save() {
    if (!this.isAccessAllowed() || !this.canSaveSig()) return;
    const u = this.selectedUser();
    if (!u) return;

    this.saving.set(true);

    const payload: ICoworkerPublic = {
      userId: u.id,
      firstName: (this.form.get('firstName')!.value ?? '').trim(),
      lastName:  (this.form.get('lastName')!.value  ?? '').trim(),
      displayName: (this.form.get('nickname')!.value ?? '').trim() || null,
    };

    this.coworkerDirectoryService
      .upsert(payload)
      .pipe(
        // Po sukcesie: doczytaj świeże dane tylko dla wybranego userId
        switchMap(() =>
          this.backendService
            .getOneByFields<ICoworkerPublic>('coworkers_public', { userId: u.id })
            .pipe(catchError(() => of(null as ICoworkerPublic | null)))
        ),
        tap(fresh => { if (fresh) this.patchFormFromData(fresh); }),
        finalize(() => {
          this.saving.set(false);
          const t = this.saveSuccessToast();
          if (t) {
            this.toastService.show({
              template: t,
              classname: 'bg-success text-white',
              header: 'Zapisano!',
            });
          }
          this.form.markAsPristine();
        })
      )
      .subscribe({
        error: () => {
          this.saving.set(false);
          const t = this.saveErrorToast();
          if (t) {
            this.toastService.show({
              template: t,
              classname: 'bg-danger text-white',
              header: 'Błąd zapisu',
            });
          }
        },
      });
  }
}
