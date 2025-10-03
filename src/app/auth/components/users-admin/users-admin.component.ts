import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, map, tap } from 'rxjs';

import { BackendService, IPagination } from '../../../core/services/backend/backend.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AuthService } from '../../../core/services/auth/auth.service';

import { hasMinimumCoworkerRole, hierarchy as CoworkerHierarchy } from '../../../core/utils/required-roles';
import { CoworkerRoles, RoleDisplay } from '../../../core/enums/roles';
import { IUser } from '../../../core/interfaces/i-user';
import { FilterOperator } from '../../../core/enums/filterOperator';

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPaginationModule],
  templateUrl: './users-admin.component.html',
  styleUrls: ['./users-admin.component.scss'],
})
export class UsersAdminComponent implements OnInit {
  // --- serwisy ---
  private readonly backend = inject(BackendService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  // --- uprawnienia Recepcja+ ---
  readonly currentUser = computed(() => this.auth.user());
  readonly isAllowed = computed(() =>
    hasMinimumCoworkerRole(this.currentUser(), CoworkerRoles.Reception)
  );

  // minimalna rola (fallback dla selecta)
  readonly minAssignableRole = CoworkerRoles.User;

  // Role do wyboru: kolejność z hierarchy, przycięte do Reception (włącznie)
  readonly allowedRoleOptions = computed<CoworkerRoles[]>(() => {
    const idx = CoworkerHierarchy.indexOf(CoworkerRoles.Reception);
    return idx >= 0 ? CoworkerHierarchy.slice(0, idx + 1) : [CoworkerRoles.User];
  });

  roleLabelFromEnum(r: CoworkerRoles): string {
    return RoleDisplay[r] ?? String(r);
  }

  // --- stan listy i paginacji ---
  readonly pageSizeOptions = [10, 50, 100];
  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);

  // ngb-pagination dwukierunkowo z property
  get currentPageRef(): number { return this.currentPage(); }
  set currentPageRef(v: number) { this.currentPage.set(v); }

  readonly totalUsers = signal<number>(0);
  readonly pageUsers = signal<IUser[]>([]);

  // cache dla wyszukiwarki
  private allUsersFetched = signal<boolean>(false);
  private allUsers = signal<IUser[]>([]);

  // --- wyszukiwarka (RxJS) ---
  private readonly searchInput$ = new Subject<string>();
  readonly searchQuery = signal<string>('');
  readonly isSearchActive = computed(() => this.searchQuery().trim().length >= 3);

  readonly filteredUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (q.length < 3) return [];
    const src = this.allUsers();
    return src.filter(u =>
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.firstName ?? '').toLowerCase().includes(q) ||
      (u.nickname ?? '').toLowerCase().includes(q)
    );
  });

  readonly pagedUsers = computed(() => {
    if (!this.isAllowed()) return [] as IUser[];
    if (this.isSearchActive()) {
      const start = (this.currentPage() - 1) * this.pageSize();
      return this.filteredUsers().slice(start, start + this.pageSize());
    }
    return this.pageUsers();
  });

  // --- toasty ---
  readonly saveSuccessToast = viewChild<TemplateRef<unknown>>('saveSuccessToast');
  readonly saveErrorToast = viewChild<TemplateRef<unknown>>('saveErrorToast');

  // --- lifecycle ---
  ngOnInit(): void {
    if (!this.isAllowed()) return;

    this.loadPage(1);

    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((raw) => {
          const term = (raw ?? '').trim();
          this.searchQuery.set(term);
          this.currentPage.set(1);

          if (term.length < 3) return of(null);
          if (this.allUsersFetched()) return of(null);

          return this.backend
            .getAll<IUser>('users', 'firstName', 'asc', {
              filters: { isTestUser: { operator: FilterOperator.EQ, value: false } },
            })
            .pipe(
              tap((list) => {
                this.allUsers.set(list);
                this.allUsersFetched.set(true);
              }),
              map(() => null)
            );
        })
      )
      .subscribe();
  }

  // --- UI API ---
  onSearchInput(ev: Event) {
    const val = (ev.target as HTMLInputElement | null)?.value ?? '';
    this.searchInput$.next(val);
  }

  // Przyciski do wyboru pageSize (data-size na buttonie)
onPageSizeClick(ev: Event) {
  const target = ev.target as HTMLElement | null;
  const btn = target?.closest('button');
  const raw = btn?.getAttribute('data-size') ?? '';
  const size = Number(raw);

  if (!Number.isFinite(size)) return;
  if (this.pageSize() === size) return;

  this.pageSize.set(size);
  this.currentPage.set(1);

  if (!this.isSearchActive()) {
    this.loadPage(1);
  }
}

  onPageChange(page: number) {
    this.currentPage.set(page);
    if (!this.isSearchActive()) this.loadPage(page);
  }

  onRowClick(_user: IUser) {
    // miejsce na rozwijane szczegóły — celowo puste
  }

  canEditRole(_target: IUser): boolean {
    return this.isAllowed();
  }

  // Zwraca konkretną wartość CoworkerRoles z selecta (bez rzutowań i liczb pośrednich)
  private readRoleFromEvent(ev: Event): CoworkerRoles | null {
    const raw = (ev.target as HTMLSelectElement | null)?.value ?? '';
    for (const role of this.allowedRoleOptions()) {
      if (String(role) === raw) return role;
    }
    return null;
  }

  onRoleChange(ev: Event, user: IUser) {
    const candidate = this.readRoleFromEvent(ev);
    if (candidate === null) return;

    this.backend.update<IUser>('users', user.id, { coworker: candidate }).subscribe({
      next: (updated) => {
        this.pageUsers.update(list =>
          list.map(u => (u.id === updated.id ? { ...u, coworker: updated.coworker } : u))
        );
        if (this.allUsersFetched()) {
          this.allUsers.update(list =>
            list.map(u => (u.id === updated.id ? { ...u, coworker: updated.coworker } : u))
          );
        }
        const t = this.saveSuccessToast();
        if (t) {
          this.toast.show({ template: t, classname: 'bg-success text-white', header: 'Zmieniono rolę' });
        }
      },
      error: () => {
        const t = this.saveErrorToast();
        if (t) {
          this.toast.show({ template: t, classname: 'bg-danger text-white', header: 'Nie udało się zapisać' });
        }
      },
    });
  }

  // --- pobranie strony bez wyszukiwarki ---
  private loadPage(page: number) {
    const pagination: IPagination = {
      page,
      pageSize: this.pageSize(),
      filters: { isTestUser: { operator: FilterOperator.EQ, value: false } },
    };

    this.backend.getAll<IUser>('users', 'firstName', 'asc', pagination).subscribe({
      next: (users) => {
        this.pageUsers.set(users);
        this.backend.getCount<IUser>('users', pagination.filters).subscribe({
          next: (count) => this.totalUsers.set(count),
          error: () => this.totalUsers.set(users.length),
        });
      },
      error: () => {
        this.pageUsers.set([]);
        this.totalUsers.set(0);
      },
    });
  }
}
