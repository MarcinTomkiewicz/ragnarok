import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  NgbDropdownModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { startWith, switchMap, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { Rooms, SortedRooms } from '../../../core/enums/rooms';
import { EventFull } from '../../../core/interfaces/i-events';
import { EventService } from '../../../core/services/event/event.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import {
  AttractionKind,
  AttractionKindLabel,
  EventTag,
  EventTagLabel,
  ExcludeNth,
  ExcludeNthLabel,
  HostSignupScope,
  HostSignupScopeLabel,
  RecurrenceKind,
  RecurrenceKindLabel,
  WeeklyInterval,
  WeeklyIntervalLabel,
  MonthlyNth,
  MonthlyNthLabel,
} from '../../../core/enums/events';
import {
  formatYmdLocal,
  weekdayOptionsPl,
} from '../../../core/utils/weekday-options';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';

type OccurrenceMode = 'SINGLE' | 'RECURRENT';
type RecPattern = 'WEEKLY_1' | 'WEEKLY_2' | 'MONTHLY_NTH' | 'MONTHLY_DOM';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbDropdownModule,
    NgbTooltipModule,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly events = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly images = inject(ImageStorageService);
  private readonly destroyRef = inject(DestroyRef);

  event = input<EventFull | null>(null);
  saved = output<void>();

  coverFile = signal<File | null>(null);
  coverPreviewUrl = signal<string | null>(null);
  private readonly coverMode = signal<'keep' | 'file' | 'remove'>('keep');
  roomsList = SortedRooms;

  AttractionKind = AttractionKind;
  HostSignupScope = HostSignupScope;
  RecurrenceKind = RecurrenceKind;
  EventTag = EventTag;
  AttractionKindLabel = AttractionKindLabel;
  HostSignupScopeLabel = HostSignupScopeLabel;
  RecurrenceKindLabel = RecurrenceKindLabel;
  EventTagLabel = EventTagLabel;

  readonly weekdays = weekdayOptionsPl();

  readonly patternOptions: { value: RecPattern; label: string }[] = [
    { value: 'WEEKLY_1', label: WeeklyIntervalLabel[WeeklyInterval.EveryWeek] },
    {
      value: 'WEEKLY_2',
      label: WeeklyIntervalLabel[WeeklyInterval.EveryTwoWeeks],
    },
    {
      value: 'MONTHLY_NTH',
      label: RecurrenceKindLabel[RecurrenceKind.MonthlyNthWeekday],
    },
    {
      value: 'MONTHLY_DOM',
      label: RecurrenceKindLabel[RecurrenceKind.MonthlyDayOfMonth],
    },
  ];

  readonly monthlyNthOptions = [
    { value: MonthlyNth.First, label: MonthlyNthLabel[MonthlyNth.First] },
    { value: MonthlyNth.Second, label: MonthlyNthLabel[MonthlyNth.Second] },
    { value: MonthlyNth.Third, label: MonthlyNthLabel[MonthlyNth.Third] },
    { value: MonthlyNth.Fourth, label: MonthlyNthLabel[MonthlyNth.Fourth] },
    { value: MonthlyNth.Last, label: MonthlyNthLabel[MonthlyNth.Last] },
  ];
  readonly excludeNthOptions = [
    { value: ExcludeNth.None, label: ExcludeNthLabel[ExcludeNth.None] },
    { value: ExcludeNth.First, label: ExcludeNthLabel[ExcludeNth.First] },
    { value: ExcludeNth.Second, label: ExcludeNthLabel[ExcludeNth.Second] },
    { value: ExcludeNth.Third, label: ExcludeNthLabel[ExcludeNth.Third] },
    { value: ExcludeNth.Fourth, label: ExcludeNthLabel[ExcludeNth.Fourth] },
    { value: ExcludeNth.Last, label: ExcludeNthLabel[ExcludeNth.Last] },
  ];

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    slug: [{ value: '', disabled: true }, [Validators.required]],
    shortDescription: ['', [Validators.required]],
    longDescription: ['', [Validators.required]],
    facebookLink: [''],
    coverImagePath: ['' as string | undefined],
    rooms: [[] as string[]],
    isActive: [true],
    isForBeginners: [false],
    requiresHosts: [false],
    entryFeePln: [0, [Validators.min(0)]],
    blockSlots: [true],

    attractionType: [AttractionKind.Session],
    hostSignup: [HostSignupScope.Staff],
    startTime: ['', [Validators.required]],
    endTime: ['', [Validators.required]],
    occurrenceMode: ['RECURRENT' as OccurrenceMode],
    singleDate: [''],
    startDate: [''],
    endDate: [''],
    recPattern: ['WEEKLY_1' as RecPattern],
    weekday: [0],
    excludeNth: [ExcludeNth.None as number],
    monthlyNth: [MonthlyNth.First as number],
    monthlyWeekday: [4],
    dayOfMonth: [1, [Validators.min(1), Validators.max(31)]],
    exdates: [[] as string[]],
    tags: [[] as EventTag[]],
  });

  get f() {
    return this.form.controls;
  }
  isEdit = computed(() => !!this.event());
  title = computed(() =>
    this.isEdit() ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'
  );

  readonly successTpl = viewChild<TemplateRef<unknown>>('eventSuccessToast');
  readonly errorTpl = viewChild<TemplateRef<unknown>>('eventErrorToast');

  ngOnInit() {
    const e = (this.event() ??
      this.route.snapshot.data['event']) as EventFull | null;
    if (e) {
      this.f.slug.setValue(e.slug);
      this.form.patchValue({
        name: e.name,
        shortDescription: e.shortDescription,
        longDescription: e.longDescription,
        facebookLink: e.facebookLink ?? '',
        coverImagePath: e.coverImagePath ?? '',
        rooms: e.rooms ?? [],
        isActive: e.isActive,
        isForBeginners: e.isForBeginners,
        requiresHosts: e.requiresHosts,
        entryFeePln: e.entryFeePln ?? 0,

        attractionType: e.attractionType,
        hostSignup: e.hostSignup,
        startTime: e.startTime.slice(0, 5),
        endTime: e.endTime.slice(0, 5),
      });

      if (e.singleDate) {
        this.f.occurrenceMode.setValue('SINGLE');
        this.f.singleDate.setValue(e.singleDate);
      } else if (e.recurrence) {
        this.f.occurrenceMode.setValue('RECURRENT');
        if (e.recurrence.kind === RecurrenceKind.Weekly) {
          this.f.recPattern.setValue(
            e.recurrence.interval === 2 ? 'WEEKLY_2' : 'WEEKLY_1'
          );
          this.f.weekday.setValue(e.recurrence.byweekday?.[0] ?? 4);
        } else if (e.recurrence.kind === RecurrenceKind.MonthlyNthWeekday) {
          this.f.recPattern.setValue('MONTHLY_NTH');
          this.f.monthlyNth.setValue(
            e.recurrence.monthlyNth ?? MonthlyNth.First
          );
          this.f.monthlyWeekday.setValue(e.recurrence.monthlyWeekday ?? 4);
        } else if (e.recurrence.kind === RecurrenceKind.MonthlyDayOfMonth) {
          this.f.recPattern.setValue('MONTHLY_DOM');
          this.f.dayOfMonth.setValue((e.recurrence as any).dayOfMonth ?? 1);
        }
        this.f.startDate.setValue(e.recurrence.startDate ?? '');
        this.f.endDate.setValue(e.recurrence.endDate ?? '');
        this.f.exdates.setValue(e.recurrence.exdates ?? []);
      }
    }

    if (!this.isEdit()) {
      this.f.name.valueChanges
        .pipe(startWith(this.f.name.value), takeUntilDestroyed(this.destroyRef))
        .subscribe((val) => this.f.slug.setValue(this.toSlug(val ?? '')));
    }

    this.f.occurrenceMode.valueChanges
      .pipe(
        startWith(this.f.occurrenceMode.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((mode) => {
        if (mode === 'SINGLE') {
          this.f.singleDate.addValidators([Validators.required]);
          this.f.startDate.clearValidators();
        } else {
          this.f.singleDate.clearValidators();
          this.f.startDate.addValidators([Validators.required]);
        }
        this.f.singleDate.updateValueAndValidity({ emitEvent: false });
        this.f.startDate.updateValueAndValidity({ emitEvent: false });
      });

    this.f.recPattern.valueChanges
      .pipe(
        startWith(this.f.recPattern.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((p) => {
        if (p === 'WEEKLY_1' || p === 'WEEKLY_2') {
          this.f.weekday.addValidators([Validators.required]);
          this.f.monthlyNth.clearValidators();
          this.f.monthlyWeekday.clearValidators();
          this.f.dayOfMonth.clearValidators();
        } else if (p === 'MONTHLY_NTH') {
          this.f.monthlyNth.addValidators([Validators.required]);
          this.f.monthlyWeekday.addValidators([Validators.required]);
          this.f.weekday.clearValidators();
          this.f.dayOfMonth.clearValidators();
        } else {
          this.f.dayOfMonth.addValidators([
            Validators.required,
            Validators.min(1),
            Validators.max(31),
          ]);
          this.f.weekday.clearValidators();
          this.f.monthlyNth.clearValidators();
          this.f.monthlyWeekday.clearValidators();
        }
        this.f.weekday.updateValueAndValidity({ emitEvent: false });
        this.f.monthlyNth.updateValueAndValidity({ emitEvent: false });
        this.f.monthlyWeekday.updateValueAndValidity({ emitEvent: false });
        this.f.dayOfMonth.updateValueAndValidity({ emitEvent: false });
        this.rebuildExdates();
      });

    const applyTags = () => {
      const tags = new Set<EventTag>();
      if (this.f.isForBeginners.value) tags.add(EventTag.Beginners);
      switch (this.f.attractionType.value) {
        case AttractionKind.Session:
          tags.add(EventTag.Session);
          break;
        case AttractionKind.Discussion:
          tags.add(EventTag.Discussion);
          break;
        case AttractionKind.None:
          tags.add(EventTag.Entertainment);
          break;
      }
      this.f.tags.setValue(Array.from(tags));
    };
    applyTags();
    this.f.isForBeginners.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(applyTags);
    this.f.attractionType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(applyTags);

    this.f.excludeNth.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildExdates());
    this.f.startDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildExdates());
    this.f.endDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildExdates());
    this.f.weekday.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildExdates());
  }

  coverCdnUrl = computed<string | null>(() => {
    const blob = this.coverPreviewUrl();
    if (blob) return blob;

    if (this.coverMode() === 'remove') return null;

    const path =
      this.form.value.coverImagePath ?? this.event()?.coverImagePath ?? null;
    if (!path) return null;

    if (/^https?:\/\//i.test(path)) return path;
    return this.images.getOptimizedPublicUrl(path, 800, 450);
  });

  // Labels...
  patternLabel(): string {
    const p = this.f.recPattern.value as RecPattern;
    const o = this.patternOptions.find((x) => x.value === p);
    return o?.label ?? '';
  }
  attractionLabel(): string {
    return AttractionKindLabel[this.f.attractionType.value];
  }
  hostSignupLabel(): string {
    return HostSignupScopeLabel[this.f.hostSignup.value];
  }
  weekdayLabel(): string {
    return (
      this.weekdays.find((w) => w.value === (this.f.weekday.value ?? 4))
        ?.label ?? '—'
    );
  }
  monthlyWeekdayLabel(): string {
    return (
      this.weekdays.find((w) => w.value === (this.f.monthlyWeekday.value ?? 4))
        ?.label ?? '—'
    );
  }
  monthlyNthLabel(): string {
    return MonthlyNthLabel[this.form.value.monthlyNth as MonthlyNth] ?? '';
  }
  excludeNthLongLabel(): string {
    return this.excludeNthLongLabelFor(this.form.value.excludeNth as number);
  }
  excludeNthLongLabelFor(v: number): string {
    if (v === 0) return 'Nie wykluczaj';
    if (v === -1) return 'Wyklucz ostatnie wystąpienie w miesiącu';
    const map: Record<number, string> = {
      1: 'pierwsze',
      2: 'drugie',
      3: 'trzecie',
      4: 'czwarte',
    };
    const which = map[v] ?? String(v);
    return `Wyklucz ${which} wystąpienie w miesiącu`;
  }

  onCoverChange(ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.coverFile.set(file);

    const prev = this.coverPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.coverPreviewUrl.set(file ? URL.createObjectURL(file) : null);

    this.coverMode.set(file ? 'file' : 'keep');
  }

  removeCover() {
    const prev = this.coverPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);

    this.coverPreviewUrl.set(null);
    this.coverFile.set(null);
    this.f.coverImagePath.setValue('');
    this.coverMode.set('remove');
  }

  pickAttractionType(kind: AttractionKind) {
    this.f.attractionType.setValue(kind);
  }
  pickHostSignup(scope: HostSignupScope) {
    this.f.hostSignup.setValue(scope);
  }
  pickPattern(p: RecPattern) {
    this.f.recPattern.setValue(p);
  }
  pickWeekday(val: number) {
    this.f.weekday.setValue(val);
  }
  pickMonthlyNth(val: number) {
    this.f.monthlyNth.setValue(val);
  }
  pickMonthlyWeekday(val: number) {
    this.f.monthlyWeekday.setValue(val);
  }
  pickExcludeNth(val: number) {
    this.f.excludeNth.setValue(val);
  }

  onToggleRoom(room: Rooms, ev: Event) {
    const checked = (ev.target as HTMLInputElement | null)?.checked ?? false;
    const current = new Set(this.f.rooms.value ?? []);
    checked ? current.add(room) : current.delete(room);
    this.f.rooms.setValue(Array.from(current));
  }

  submit() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    let recurrence: any;
    if (v.occurrenceMode === 'RECURRENT') {
      if (v.recPattern === 'WEEKLY_1' || v.recPattern === 'WEEKLY_2') {
        recurrence = {
          kind: RecurrenceKind.Weekly,
          interval: v.recPattern === 'WEEKLY_2' ? 2 : 1,
          byweekday: [Number(v.weekday)],
          startDate: v.startDate || new Date().toISOString().slice(0, 10),
          endDate: v.endDate || undefined,
          exdates: v.exdates ?? [],
        };
      } else if (v.recPattern === 'MONTHLY_NTH') {
        recurrence = {
          kind: RecurrenceKind.MonthlyNthWeekday,
          interval: 1,
          monthlyNth: Number(v.monthlyNth),
          monthlyWeekday: Number(v.monthlyWeekday),
          startDate: v.startDate || new Date().toISOString().slice(0, 10),
          endDate: v.endDate || undefined,
          exdates: [],
        };
      } else {
        recurrence = {
          kind: RecurrenceKind.MonthlyDayOfMonth,
          interval: 1,
          dayOfMonth: Number(v.dayOfMonth),
          startDate: v.startDate || new Date().toISOString().slice(0, 10),
          endDate: v.endDate || undefined,
          exdates: [],
        } as any;
      }
    }

    const basePayload = {
      slug: v.slug,
      name: v.name,
      shortDescription: v.shortDescription,
      longDescription: v.longDescription,
      facebookLink: v.facebookLink || undefined,
      coverImagePath: v.coverImagePath || undefined,
      isActive: v.isActive,
      isForBeginners: v.isForBeginners,
      requiresHosts: v.requiresHosts,
      attractionType: v.attractionType,
      hostSignup: v.hostSignup,
      timezone: 'Europe/Warsaw',
      startTime: v.startTime + ':00',
      endTime: v.endTime + ':00',
      rooms: v.rooms,
      tags: v.tags,
      entryFeePln: Number(v.entryFeePln ?? 0),
      singleDate:
        v.occurrenceMode === 'SINGLE' ? v.singleDate || undefined : undefined,
      recurrence,
      autoReservation: v.blockSlots
    } satisfies Omit<EventFull, 'id'>;

    const file = this.coverFile();
    const blockSlots = !!v.blockSlots; 

    const save$ = this.isEdit()
      ? this.events.updateEvent(
          this.event()!.id,
          basePayload as Partial<EventFull>,
          file ?? undefined,
          'REPLACE_FUTURE',
          { blockSlots }
        )
      : this.events
          .createEvent(basePayload, file ?? undefined, 'REPLACE_FUTURE', {
            blockSlots,
          })
          .pipe(switchMap(() => of(void 0)));

    save$.subscribe({
      next: () => {
        const tpl = this.successTpl();
        if (tpl)
          this.toast.show({
            template: tpl,
            classname: 'bg-success text-white',
            header: 'Zapisano wydarzenie',
          });
        this.saved.emit();
        this.router.navigate(['/events'])
      },
      error: () => {
        const tpl = this.errorTpl();
        if (tpl)
          this.toast.show({
            template: tpl,
            classname: 'bg-danger text-white',
            header: 'Nie udało się zapisać wydarzenia',
          });
      },
    });
  }

  private toSlug(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private rebuildExdates() {
    const p = this.f.recPattern.value as RecPattern;
    if (p !== 'WEEKLY_1' && p !== 'WEEKLY_2') {
      this.f.exdates.setValue([]);
      return;
    }
    const nth = this.f.excludeNth.value as ExcludeNth;
    if (nth === ExcludeNth.None) {
      this.f.exdates.setValue([]);
      return;
    }
    const start = this.f.startDate.value || '';
    const end = this.f.endDate.value || '';
    if (!start || !end) {
      this.f.exdates.setValue([]);
      return;
    }
    const weekday = this.f.weekday.value ?? 4;
    const ex = this.computeExcludedNthWeekdays(start, end, weekday, nth);
    this.f.exdates.setValue(ex);
  }

  private computeExcludedNthWeekdays(
    startIso: string,
    endIso: string,
    weekday0to6: number,
    nth: ExcludeNth
  ): string[] {
    const out: string[] = [];
    const start = new Date(startIso + 'T00:00:00');
    const end = new Date(endIso + 'T00:00:00');

    const cur = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    );
    const endMonth = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)
    );

    while (cur <= endMonth) {
      const d = this.nthWeekdayOfMonth(
        cur.getUTCFullYear(),
        cur.getUTCMonth(),
        weekday0to6,
        nth
      );
      if (d) {
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (local >= start && local <= end) out.push(formatYmdLocal(local));
      }
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }

  private nthWeekdayOfMonth(
    year: number,
    month0: number,
    weekday: number,
    n: number
  ): Date | null {
    if (n > 0) {
      const first = new Date(year, month0, 1);
      const shift = (weekday - first.getDay() + 7) % 7;
      const day = 1 + shift + (n - 1) * 7;
      const d = new Date(year, month0, day);
      return d.getMonth() === month0 ? d : null;
    }
    if (n === -1) {
      const last = new Date(year, month0 + 1, 0);
      const shiftBack = (last.getDay() - weekday + 7) % 7;
      const day = last.getDate() - shiftBack;
      return new Date(year, month0, day);
    }
    return null;
  }

  ngOnDestroy(): void {
    const url = this.coverPreviewUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
