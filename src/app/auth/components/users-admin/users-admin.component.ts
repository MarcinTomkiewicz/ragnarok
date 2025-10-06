import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
  TemplateRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  map,
  tap,
} from 'rxjs';

import {
  BackendService,
  IPagination,
} from '../../../core/services/backend/backend.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AuthService } from '../../../core/services/auth/auth.service';

import {
  hasMinimumCoworkerRole,
  hierarchy as CoworkerHierarchy,
} from '../../../core/utils/required-roles';
import { CoworkerRoles, RoleDisplay } from '../../../core/enums/roles';
import { IUser } from '../../../core/interfaces/i-user';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { IconClass } from '../../../core/enums/icons';

type UserRoleUpsert = { id: string; coworker: CoworkerRoles | null };

/** Sort fields available in the Users table. */
type UserSortField = 'name' | 'email' | 'phone' | 'createdAt' | 'role';

/** DB columns mapping for server-side sort. */
const SERVER_COLUMN: Record<UserSortField, keyof IUser> = {
  name: 'firstName',
  email: 'email',
  phone: 'phoneNumber',
  createdAt: 'createdAt',
  role: 'coworker',
};

/** Role ranking for client-side sorting (no string arithmetic). */
const ROLE_RANK = new Map(CoworkerHierarchy.map((r, i) => [r, i]));

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPaginationModule],
  templateUrl: './users-admin.component.html',
  styleUrls: ['./users-admin.component.scss'],
})
export class UsersAdminComponent implements OnInit {
  // --- services ---
  private readonly backend = inject(BackendService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  // --- permissions (Reception+) ---
  readonly currentUser = computed(() => this.auth.user());
  readonly isAllowed = computed(() =>
    hasMinimumCoworkerRole(this.currentUser(), CoworkerRoles.Reception)
  );

  // minimal assignable role (fallback for select)
  readonly minAssignableRole = CoworkerRoles.User;

  // role select options
  readonly allowedRoleOptions = computed<CoworkerRoles[]>(() => {
    const idx = CoworkerHierarchy.indexOf(CoworkerRoles.Reception);
    return idx >= 0 ? CoworkerHierarchy.slice(0, idx + 1) : [CoworkerRoles.User];
  });

  roleLabelFromEnum(r: CoworkerRoles): string {
    return RoleDisplay[r] ?? String(r);
  }

  // --- sorting state ---
  readonly userSortLabels: Record<UserSortField, string> = {
    name: 'Imię',
    email: 'E-mail',
    phone: 'Telefon',
    createdAt: 'Data rejestracji',
    role: 'Rola',
  };
  readonly sortFields: UserSortField[] = ['name', 'email', 'phone', 'createdAt', 'role'];
  readonly sortField = signal<UserSortField>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  sortBy(field: UserSortField): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      // sensible defaults
      this.sortDir.set(field === 'createdAt' ? 'desc' : 'asc');
    }
    this.currentPage.set(1);
    if (!this.isSearchActive()) this.loadPage(1);
  }

  getSortIcon(field: UserSortField): string {
    if (this.sortField() !== field) return '';
    const dir = this.sortDir();
    const isNumeric = field === 'phone' || field === 'createdAt' || field === 'role';
    return isNumeric
      ? dir === 'asc' ? IconClass.NumericAsc : IconClass.NumericDesc
      : dir === 'asc' ? IconClass.AlphaAsc   : IconClass.AlphaDesc;
  }

  // --- paging ---
  readonly pageSizeOptions = [10, 50, 100];
  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);

  get currentPageRef(): number { return this.currentPage(); }
  set currentPageRef(v: number) { this.currentPage.set(v); }

  readonly totalUsers = signal<number>(0);
  readonly pageUsers = signal<IUser[]>([]);

  // cache for search
  private allUsersFetched = signal<boolean>(false);
  private allUsers = signal<IUser[]>([]);

  // --- search ---
  private readonly searchInput$ = new Subject<string>();
  readonly searchQuery = signal<string>('');
  readonly isSearchActive = computed(() => this.searchQuery().trim().length >= 3);

  /** Client-side filtered (and sorted) list for search mode. */
  readonly filteredUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (q.length < 3) return [];

    const filtered = this.allUsers().filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.nickname ?? '').toLowerCase().includes(q)
    );

    const field = this.sortField();
    const dir = this.sortDir();
    const mul = dir === 'asc' ? 1 : -1;

    const valName   = (u: IUser) => (u.firstName || u.email || '').toLowerCase();
    const valEmail  = (u: IUser) => (u.email || '').toLowerCase();
    const valPhone  = (u: IUser) => parseInt((u.phoneNumber || '').replace(/\D/g, ''), 10) || 0;
    const valCreated= (u: IUser) => new Date(u.createdAt ?? 0).getTime() || 0;
    const valRole   = (u: IUser) => ROLE_RANK.get(u.coworker ?? CoworkerRoles.User) ?? -1;

    return [...filtered].sort((a, b) => {
      if (field === 'name')      return mul * valName(a).localeCompare(valName(b), 'pl', { numeric: true, sensitivity: 'base' });
      if (field === 'email')     return mul * valEmail(a).localeCompare(valEmail(b), 'pl', { numeric: true, sensitivity: 'base' });
      if (field === 'phone')     return mul * (valPhone(a) - valPhone(b));
      if (field === 'createdAt') return mul * (valCreated(a) - valCreated(b));
      if (field === 'role')      return mul * (valRole(a) - valRole(b));
      return 0;
    });
  });

  /** Final list for the table (paged). */
  readonly pagedUsers = computed(() => {
    if (!this.isAllowed()) return [] as IUser[];
    if (this.isSearchActive()) {
      const start = (this.currentPage() - 1) * this.pageSize();
      return this.filteredUsers().slice(start, start + this.pageSize());
    }
    return this.pageUsers();
  });

  // --- toasts ---
  readonly saveSuccessToast = viewChild<TemplateRef<unknown>>('saveSuccessToast');
  readonly saveErrorToast   = viewChild<TemplateRef<unknown>>('saveErrorToast');

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
    // placeholder for expandable row details
  }

  canEditRole(_target: IUser): boolean {
    return this.isAllowed();
  }

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
    if (user.coworker === candidate) return;

    this.backend.update<IUser>('users', user.id, { coworker: candidate }).subscribe({
      next: (updated) => {
        this.pageUsers.update((list) =>
          list.map((u) => (u.id === updated.id ? { ...u, coworker: updated.coworker } : u))
        );
        if (this.allUsersFetched()) {
          this.allUsers.update((list) =>
            list.map((u) => (u.id === updated.id ? { ...u, coworker: updated.coworker } : u))
          );
        }
        const t = this.saveSuccessToast();
        if (t) {
          this.toast.show({
            template: t,
            classname: 'bg-success text-white',
            header: 'Zmieniono rolę',
          });
        }
      },
      error: () => {
        const t = this.saveErrorToast();
        if (t) {
          this.toast.show({
            template: t,
            classname: 'bg-danger text-white',
            header: 'Nie udało się zapisać',
          });
        }
      },
    });
  }

  // --- server fetch (respects current sort) ---
  private loadPage(page: number) {
    const pagination: IPagination = {
      page,
      pageSize: this.pageSize(),
      filters: { isTestUser: { operator: FilterOperator.EQ, value: false } },
    };

    const sortCol = SERVER_COLUMN[this.sortField()] as keyof IUser;
    const sortDir = this.sortDir();

    this.backend
      .getAll<IUser>('users', sortCol, sortDir, pagination)
      .subscribe({
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
