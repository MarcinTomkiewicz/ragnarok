import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';
import { WorkLogService } from '../../core/services/work-log/work-log.service';
import { IWorkLog } from '../../../core/interfaces/i-work-log';
import { format, parseISO } from 'date-fns';
import { ToastService } from '../../../core/services/toast/toast.service';
import { forkJoin, Observable } from 'rxjs';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { pl } from 'date-fns/locale';

type Row = {
  date: string;
  weekday: string;
  hours: number | null;
  comment: string;
  id?: string;
};

@Component({
  selector: 'app-my-work-log',
  standalone: true,
  imports: [CommonModule, NgbToastModule],
  templateUrl: './my-work-log.component.html',
  styleUrls: ['./my-work-log.component.scss'],
})
export class MyWorkLogComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(WorkLogService);
  private readonly toast = inject(ToastService);

  readonly userId = this.auth.user()?.id!;

  readonly toastSaved = viewChild<TemplateRef<unknown>>('toastSaved');
  readonly toastError = viewChild<TemplateRef<unknown>>('toastError');
  readonly toastNoChanges = viewChild<TemplateRef<unknown>>('toastNoChanges');

  readonly monthOffset = signal<0 | -1>(0);

  readonly rows = signal<Row[]>([]);
  private readonly original = signal<Map<string, IWorkLog>>(new Map());

  readonly totalHours = computed(() =>
    this.rows().reduce(
      (acc, r) => acc + (typeof r.hours === 'number' ? r.hours : 0),
      0
    )
  );

  readonly monthLabel = computed(() => {
    const { start } = this.svc.computeMonthDays(this.monthOffset());
    const label = format(start, 'LLLL yyyy', { locale: pl });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  ngOnInit(): void {
    this.load();
  }

  load() {
    const { days } = this.svc.computeMonthDays(this.monthOffset());
    this.svc.getForDates(this.userId, days).subscribe({
      next: (logs) => {
        const byDate = new Map<string, IWorkLog>();
        for (const l of logs) byDate.set(l.workDate, l);
        this.original.set(byDate);

        const out: Row[] = days.map((d) => {
          const l = byDate.get(d);
          return {
            date: d,
            weekday: this.formatWeekday(d),
            hours: l ? Number(l.hours) : null,
            comment: l?.comment ?? '',
            id: l?.id,
          };
        });
        this.rows.set(out);
      },
      error: (e) => {
        this.original.set(new Map());
        this.rows.set([]);
        console.error('Błąd pobierania work log:', e);
      },
    });
  }

  formatWeekday(ymd: string): string {
    const d = parseISO(ymd);
    return format(d, 'EEEE', { locale: pl });
  }

  formatDate(ymd: string): string {
    return format(parseISO(ymd), 'dd.MM.yyyy');
  }

  switchTo(offset: 0 | -1) {
    if (this.monthOffset() === offset) return;
    this.monthOffset.set(offset);
    this.load();
  }

  onHoursInput(date: string, evt: Event) {
    const input = evt.target as HTMLInputElement | null;
    const v = input?.value ?? '';
    const num = v === '' ? null : Number(v);
    const next = this.rows().map((r) =>
      r.date === date ? { ...r, hours: Number.isFinite(num) ? num : null } : r
    );
    this.rows.set(next);
  }

  onCommentInput(date: string, evt: Event) {
    const input = evt.target as HTMLInputElement | HTMLTextAreaElement | null;
    const val = input?.value ?? '';
    const next = this.rows().map((r) =>
      r.date === date ? { ...r, comment: val } : r
    );
    this.rows.set(next);
  }

  save() {
    const rows = this.rows();
    const orig = this.original();

    const toUpsert: IWorkLog[] = [];
    const toDelete: string[] = [];

    for (const r of rows) {
      const exists = orig.get(r.date);
      const meaningful = r.hours != null && r.hours > 0;

      if (meaningful) {
        toUpsert.push({
          id: exists?.id,
          userId: this.userId,
          workDate: r.date,
          hours: r.hours!,
          comment: r.comment?.trim() || null,
        });
      } else if (exists) {
        toDelete.push(r.date);
      }
    }

    const ops: Array<Observable<unknown>> = [];
    if (toDelete.length)
      ops.push(this.svc.deleteByDates(this.userId, toDelete));
    if (toUpsert.length) ops.push(this.svc.upsertMany(toUpsert));

    if (!ops.length) {
      const t = this.toastNoChanges();
      if (t)
        this.toast.show({
          template: t,
          classname: 'bg-secondary text-white',
          header: 'Info',
        });
      return;
    }

    forkJoin(ops).subscribe({
      next: () => {
        const t = this.toastSaved();
        if (t)
          this.toast.show({
            template: t,
            classname: 'bg-success text-white',
            header: 'Zapisano',
          });
        this.load();
      },
      error: (e) => {
        console.error(e);
        const t = this.toastError();
        if (t)
          this.toast.show({
            template: t,
            classname: 'bg-danger text-white',
            header: 'Błąd',
          });
      },
    });
  }

  clearAll() {
    const orig = this.original();
    const next = this.rows().map((r) => {
      const l = orig.get(r.date);
      return {
        date: r.date,
        weekday: r.weekday,
        hours: l ? Number(l.hours) : null,
        comment: l?.comment ?? '',
        id: l?.id,
      };
    });
    this.rows.set(next);
  }

  trackByDate = (_: number, r: Row) => r.date;

  resetRow(date: string) {
    const l = this.original().get(date);
    this.rows.set(
      this.rows().map((r) =>
        r.date === date
          ? {
              ...r,
              hours: l ? Number(l.hours) : null,
              comment: l?.comment ?? '',
              id: l?.id,
            }
          : r
      )
    );
  }

  private normComment(v: string | null | undefined): string {
    return (v ?? '').trim();
  }

  isRowDirty(r: Row): boolean {
    const orig = this.original().get(r.date);

    if (!orig) {
      return (
        (r.hours != null && r.hours > 0) || this.normComment(r.comment) !== ''
      );
    }

    const hoursSame = (r.hours ?? null) === Number(orig.hours);
    const commentSame =
      this.normComment(r.comment) === this.normComment(orig.comment);

    return !(hoursSame && commentSame);
  }
}
