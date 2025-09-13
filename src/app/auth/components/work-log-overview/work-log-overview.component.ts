import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { IconClass } from '../../../core/enums/icons';
import { CoworkerRoles, RoleDisplay } from '../../../core/enums/roles';
import { SortOrder, WorklogSortField } from '../../../core/enums/search';
import { IUser } from '../../../core/interfaces/i-user';
import { IWorkLog } from '../../../core/interfaces/i-work-log';
import { BackendService } from '../../../core/services/backend/backend.service';
import { Row } from '../../../core/types/row';
import { CoworkersService } from '../../core/services/coworkers/coworkers.service';
import { WorkLogService } from '../../core/services/work-log/work-log.service';

@Component({
  selector: 'app-work-log-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './work-log-overview.component.html',
  styleUrl: './work-log-overview.component.scss',
})
export class WorkLogOverviewComponent implements OnInit {
  private readonly backend = inject(BackendService);
  private readonly worklog = inject(WorkLogService);
  private readonly coworkers = inject(CoworkersService);

  readonly monthOffset = signal<0 | -1>(0);

  private readonly logsAll = signal<IWorkLog[]>([]);
  private readonly usersMap = signal<Map<string, IUser>>(new Map());

  private readonly rowsByUser = signal<Map<string, Row[]>>(new Map());
  private readonly totalsByUser = signal<Map<string, number>>(new Map());

  readonly expandedUserId = signal<string | null>(null);

  readonly sortField = signal<WorklogSortField>(WorklogSortField.Role);
  readonly sortDir = signal<SortOrder>(SortOrder.Asc);

  readonly WorklogSortField = WorklogSortField;

  readonly grandTotal = computed(() => {
    let sum = 0;
    for (const v of this.totalsByUser().values()) sum += v ?? 0;
    return sum;
  });

  readonly currentMonthLabel = computed(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const label = format(start, 'LLLL yyyy', { locale: pl });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly viewedMonthLabel = computed(() => {
    const { start } = this.worklog.computeMonthDays(this.monthOffset());
    const label = format(start, 'LLLL yyyy', { locale: pl });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly overview = computed(() => {
    const totals = this.totalsByUser();
    const users = Array.from(this.usersMap().values()).map((u) => ({
      user: u,
      roleLabel: this.roleLabel(u),
      total: totals.get(u.id) ?? 0,
      name: this.displayName(u),
    }));

    const field = this.sortField();
    const dir = this.sortDir();

    const cmpStr = (a: string, b: string) => a.localeCompare(b);
    const cmpNum = (a: number, b: number) => a - b;

    users.sort((a, b) => {
      let cmp = 0;

      switch (field) {
        case WorklogSortField.User:
          cmp = cmpStr(a.name, b.name);
          break;
        case WorklogSortField.Role:
          cmp = cmpStr(a.roleLabel, b.roleLabel);
          break;
        case WorklogSortField.Total:
          cmp = cmpNum(a.total, b.total);
          break;
      }

      if (dir === SortOrder.Desc) cmp = -cmp;
      if (cmp !== 0) return cmp;

      const byName = cmpStr(a.name, b.name);
      if (byName !== 0) return byName;
      const byRole = cmpStr(a.roleLabel, b.roleLabel);
      if (byRole !== 0) return byRole;
      return cmpNum(b.total, a.total);
    });

    return users;
  });

  setSort(field: WorklogSortField) {
    if (this.sortField() === field) {
      this.sortDir.set(
        this.sortDir() === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc
      );
    } else {
      this.sortField.set(field);
      this.sortDir.set(
        field === WorklogSortField.Total ? SortOrder.Desc : SortOrder.Asc
      );
    }
  }

  sortIcon(field: WorklogSortField): string {
    const dir = this.sortDir();
    const active = this.sortField() === field;

    if (!active) return IconClass.ArrowUpDown;
    if (field === WorklogSortField.Total) {
      return dir === SortOrder.Asc
        ? IconClass.NumericAsc
        : IconClass.NumericDesc;
    }
    return dir === SortOrder.Asc ? IconClass.AlphaAsc : IconClass.AlphaDesc;
  }

  readonly selectedRows = computed(() => {
    const id = this.expandedUserId();
    if (!id) return [] as Row[];
    return this.rowsByUser().get(id) ?? [];
  });

  ngOnInit(): void {
    this.load();
  }

  load() {
    const { days } = this.worklog.computeMonthDays(this.monthOffset());

    this.coworkers.getWithMinRole(CoworkerRoles.Gm).subscribe({
      next: (usersAll) => {
        const users = usersAll.filter(
          (u) => u.coworker !== CoworkerRoles.Owner
        );

        const uMap = new Map<string, IUser>();
        for (const u of users) uMap.set(u.id, u);
        this.usersMap.set(uMap);

        const userIds = users.map((u) => u.id);

        this.backend
          .getAll<IWorkLog>('user_work_log', undefined, SortOrder.Asc, {
            filters: {
              userId: { operator: FilterOperator.IN, value: userIds },
              workDate: { operator: FilterOperator.IN, value: days },
            },
          })
          .subscribe({
            next: (logs) => {
              this.logsAll.set(logs);

              const byUser = new Map<string, IWorkLog[]>();
              for (const l of logs) {
                const arr = byUser.get(l.userId) ?? [];
                arr.push(l);
                byUser.set(l.userId, arr);
              }

              const rowsMap = new Map<string, Row[]>();
              const totals = new Map<string, number>();

              for (const u of users) {
                const userLogs = byUser.get(u.id) ?? [];
                const byDate = new Map(userLogs.map((x) => [x.workDate, x]));

                const rows: Row[] = days.map((d) => {
                  const l = byDate.get(d);
                  return {
                    date: d,
                    weekday: format(parseISO(d), 'EEEE', { locale: pl }),
                    hours: l ? Number(l.hours) : null,
                    comment: l?.comment ?? '',
                  };
                });

                rowsMap.set(u.id, rows);
                totals.set(
                  u.id,
                  rows.reduce(
                    (a, r) => a + (typeof r.hours === 'number' ? r.hours : 0),
                    0
                  )
                );
              }

              this.rowsByUser.set(rowsMap);
              this.totalsByUser.set(totals);
            },
            error: (e) => {
              console.error('Błąd pobierania logów:', e);
              this.rowsByUser.set(new Map());
              this.totalsByUser.set(new Map());
            },
          });
      },
      error: (e) => {
        console.error('Błąd pobierania użytkowników GM+:', e);
        this.usersMap.set(new Map());
        this.rowsByUser.set(new Map());
        this.totalsByUser.set(new Map());
      },
    });
  }

  switchTo(offset: 0 | -1) {
    if (this.monthOffset() === offset) return;
    this.monthOffset.set(offset);
    this.expandedUserId.set(null);
    this.load();
  }

  toggleExpand(userId: string) {
    this.expandedUserId.set(this.expandedUserId() === userId ? null : userId);
  }

  displayName(u: IUser | undefined): string {
    if (!u) return 'Użytkownik';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName || u.email || 'Użytkownik';
  }

  roleLabel(u: IUser | undefined): string {
    return u?.coworker ? RoleDisplay[u.coworker] : '—';
  }

  formatDate(ymd: string): string {
    return format(parseISO(ymd), 'dd.MM.yyyy');
  }
}
