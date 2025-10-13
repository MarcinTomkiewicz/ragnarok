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
  NgbModal,
  NgbModalModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { startWith, switchMap, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { Rooms, SortedRooms } from '../../../core/enums/rooms';
import { EventFull, EventRoomPlan } from '../../../core/interfaces/i-events';
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
  ParticipantSignupScope,
} from '../../../core/enums/events';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';
import { toSlug } from '../../../core/utils/slug-creator';
import {
  formatYmdLocal,
  weekdayOptionsPl,
} from '../../../core/utils/weekday-options';
import {
  HostSignupLevel,
  RoomPurpose,
  RoomScheduleKind,
  RoomPurposeLabel,
} from '../../../core/enums/event-rooms';
import { InfoModalComponent } from '../../../common/info-modal/info-modal.component';

type OccurrenceMode = 'SINGLE' | 'RECURRENT';
type RecPattern = 'WEEKLY_1' | 'WEEKLY_2' | 'MONTHLY_NTH' | 'MONTHLY_DOM';

type SlotVM = {
  startTime: string;
  endTime: string;
  purpose?: RoomPurpose;
  customTitle?: string | null;

  requiresHosts?: boolean | null;
  hostScope?: HostSignupScope | null;

  requiresParticipants?: boolean | null;
  /** kept for compatibility (not sent) */
  participantSignup?: ParticipantSignupScope | null;
  sessionCapacity?: number | null;
};

type RoomPlanVM = {
  roomName: string;
  purpose: RoomPurpose;
  customTitle: string | null;
  scheduleKind: RoomScheduleKind;
  intervalHours: number | null;

  requiresHosts?: boolean | null;
  hostScope?: HostSignupScope | null;

  // defaults for Schedule and used for FullSpan/Interval
  requiresParticipants?: boolean | null;
  /** kept for compatibility (not sent) */
  participantSignup?: ParticipantSignupScope | null;
  sessionCapacity?: number | null;

  /** host level persisted in DB: ROOM (FullSpan/Interval) / SLOT (Schedule) */
  hostSignup: HostSignupLevel | null;

  slots: SlotVM[];

  /** UI helper: bulk toggle for slots */
  allSlotsRequireHosts?: boolean;
};

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbDropdownModule,
    NgbTooltipModule,
    NgbModalModule,
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
  private readonly modal = inject(NgbModal);

  event = input<EventFull | null>(null);
  saved = output<void>();

  Number = Number;

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
  ParticipantSignupScope = ParticipantSignupScope;
  HostSignupLevel = HostSignupLevel;
  RoomScheduleKind = RoomScheduleKind;
  RoomPurpose = RoomPurpose;
  RoomPurposeLabel = RoomPurposeLabel;

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
    hostSignupLevel: [HostSignupLevel.Event],

    // enum decides whether signups are enabled
    participantSignup: [ParticipantSignupScope.Both as ParticipantSignupScope],
    wholeCapacity: [0],
    sessionCapacity: [5],

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

  roomPlans = signal<Record<string, RoomPlanVM>>({});

  get f() {
    return this.form.controls;
  }

  // ───────────────────────── view helpers ─────────────────────────
  isWholeSignups() {
    return this.form.value.participantSignup === ParticipantSignupScope.Whole;
  }
  isNoneSignups() {
    return this.form.value.participantSignup === ParticipantSignupScope.None;
  }
  canHaveSlotSignups() {
    return !this.isWholeSignups() && !this.isNoneSignups();
  }

  effectiveSlotRequiresParticipants(room: string, s: SlotVM) {
    const plan = this.roomPlans()[room];
    return (s.requiresParticipants ?? plan?.requiresParticipants ?? false) === true;
  }

  effectiveSlotCapacity(room: string, s: SlotVM) {
    const plan = this.roomPlans()[room];
    const purpose = s.purpose ?? plan?.purpose ?? this.defaultPurposeFromEvent();
    const fallback = this.purposeIsSession(purpose) ? (this.form.value.sessionCapacity ?? 5) : 0;
    const val = s.sessionCapacity ?? plan?.sessionCapacity ?? fallback;
    return this.normalizeCapacityByPurpose(purpose, val);
  }

  isEdit = computed(() => !!this.event());
  title = computed(() => (this.isEdit() ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'));

  readonly successTpl = viewChild<TemplateRef<unknown>>('eventSuccessToast');
  readonly errorTpl = viewChild<TemplateRef<unknown>>('eventErrorToast');

  // Normalizers keep API tri-state semantics (true/false/null) and numeric parsing.
  private asBoolTri(v: boolean | null | undefined): boolean | null {
    return v === true ? true : v === false ? false : null;
  }
  private asMaybeNumber(v: number | string | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Capacities:
  // - Session: clamp to 3–5 (default 5)
  // - non-Session: >= 0 (default 0; 0 = no limit)
  private purposeIsSession(p: RoomPurpose | null | undefined) {
    return p === RoomPurpose.Session;
  }
  private normalizeCapacityByPurpose(p: RoomPurpose | null | undefined, n: number | string | null | undefined): number {
    const num = Number(n ?? (this.purposeIsSession(p) ? 5 : 0));
    if (this.purposeIsSession(p)) {
      if (!Number.isFinite(num)) return 5;
      return Math.max(3, Math.min(5, Math.trunc(num)));
    }
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.trunc(num));
  }
  private canHaveSlotCapacity(scope: ParticipantSignupScope | null | undefined): boolean {
    // Limity slotów tylko gdy zapisy na sloty są włączone (Session/Both)
    return scope === ParticipantSignupScope.Session || scope === ParticipantSignupScope.Both;
  }
  private isNone(scope: ParticipantSignupScope | null | undefined) {
    return scope === ParticipantSignupScope.None;
  }
  private isWhole(scope: ParticipantSignupScope | null | undefined) {
    return scope === ParticipantSignupScope.Whole;
  }
  private isBoth(scope: ParticipantSignupScope | null | undefined) {
    return scope === ParticipantSignupScope.Both;
  }
  private isSessionish(scope: ParticipantSignupScope | null | undefined) {
    return scope === ParticipantSignupScope.Session || scope === ParticipantSignupScope.Both;
  }

  coverCdnUrl = computed<string | null>(() => {
    const blob = this.coverPreviewUrl();
    if (blob) return blob;
    if (this.coverMode() === 'remove') return null;
    const path = this.form.value.coverImagePath ?? this.event()?.coverImagePath ?? null;
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return this.images.getOptimizedPublicUrl(path, 800, 450);
  });

  patternLabel(): string {
    const p = this.form.value.recPattern as RecPattern;
    const o = this.patternOptions.find((x) => x.value === p);
    return o?.label ?? '';
  }
  attractionLabel(): string {
    const t = this.f.attractionType.value ?? AttractionKind.Session;
    return AttractionKindLabel[t];
  }
  hostSignupLabel(): string {
    const s = this.f.hostSignup.value ?? HostSignupScope.Staff;
    return HostSignupScopeLabel[s];
  }
  participantSignupLabel(): string {
    const v = this.form.value.participantSignup as ParticipantSignupScope;
    if (v === ParticipantSignupScope.Session) return 'Tylko na sloty';
    if (v === ParticipantSignupScope.Both) return 'Na wydarzenie i na sloty';
    if (v === ParticipantSignupScope.None) return 'Brak zapisów';
    return 'Na całe wydarzenie';
  }
  weekdayLabel(): string {
    return this.weekdays.find((w) => w.value === (this.form.value.weekday ?? 4))?.label ?? '—';
  }
  monthlyWeekdayLabel(): string {
    return this.weekdays.find((w) => w.value === (this.form.value.monthlyWeekday ?? 4))?.label ?? '—';
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
    const map: Record<number, string> = { 1: 'pierwsze', 2: 'drugie', 3: 'trzecie', 4: 'czwarte' };
    const which = map[v] ?? String(v);
    return `Wyklucz ${which} wystąpienie w miesiącu`;
  }
  purposeLabel(p?: RoomPurpose | null): string {
    return p ? RoomPurposeLabel[p] : RoomPurposeLabel[RoomPurpose.None];
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

  onToggleRoom(room: Rooms, ev: Event) {
    const target = ev.target as HTMLInputElement | null;
    const checked = !!target?.checked;
    const current = new Set(this.f.rooms.value ?? []);
    checked ? current.add(room) : current.delete(room);
    this.f.rooms.setValue(Array.from(current));

    if (checked) this.ensurePlanFor(room);
    else this.removePlan(room);
  }

  private defaultPurposeFromEvent(): RoomPurpose {
    const a = this.f.attractionType.value ?? AttractionKind.Session;
    return a === AttractionKind.Session
      ? RoomPurpose.Session
      : a === AttractionKind.Discussion
      ? RoomPurpose.Discussion
      : RoomPurpose.Entertainment;
  }

  private ensurePlanFor(roomName: string) {
    const map = { ...this.roomPlans() };
    if (!map[roomName]) {
      map[roomName] = {
        roomName,
        purpose: this.defaultPurposeFromEvent(),
        customTitle: null,
        scheduleKind: RoomScheduleKind.FullSpan,
        intervalHours: null,

        requiresHosts: this.f.requiresHosts.value || null,
        hostScope: this.f.requiresHosts.value ? this.f.hostSignup.value ?? HostSignupScope.Staff : null,

        requiresParticipants: null,
        participantSignup: null,
        sessionCapacity: null,

        hostSignup: HostSignupLevel.Room,
        slots: [],
        allSlotsRequireHosts: undefined,
      };
      this.roomPlans.set(map);
    }
  }

  private removePlan(roomName: string) {
    const map = { ...this.roomPlans() };
    delete map[roomName];
    this.roomPlans.set(map);
  }

  ngOnInit() {
    const e = (this.event() ?? this.route.snapshot.data['event']) as EventFull | null;

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
        hostSignupLevel: (e.hostSignupLevel ?? HostSignupLevel.Event) as HostSignupLevel,
        startTime: e.startTime.slice(0, 5),
        endTime: e.endTime.slice(0, 5),

        participantSignup: (e.participantSignup ?? ParticipantSignupScope.None) as ParticipantSignupScope,
        wholeCapacity: e.wholeCapacity == null ? 0 : Number(e.wholeCapacity),
        sessionCapacity: e.sessionCapacity == null ? 5 : Number(e.sessionCapacity),
      });

      if (e.singleDate) {
        this.f.occurrenceMode.setValue('SINGLE');
        this.f.singleDate.setValue(e.singleDate);
      } else if (e.recurrence) {
        this.f.occurrenceMode.setValue('RECURRENT');
        if (e.recurrence.kind === RecurrenceKind.Weekly) {
          this.f.recPattern.setValue(e.recurrence.interval === 2 ? 'WEEKLY_2' : 'WEEKLY_1');
          this.f.weekday.setValue(e.recurrence.byweekday?.[0] ?? 4);
        } else if (e.recurrence.kind === RecurrenceKind.MonthlyNthWeekday) {
          this.f.recPattern.setValue('MONTHLY_NTH');
          this.f.monthlyNth.setValue(e.recurrence.monthlyNth ?? MonthlyNth.First);
          this.f.monthlyWeekday.setValue(e.recurrence.monthlyWeekday ?? 4);
        } else if (e.recurrence.kind === RecurrenceKind.MonthlyDayOfMonth) {
          this.f.recPattern.setValue('MONTHLY_DOM');
          this.f.dayOfMonth.setValue((e.recurrence as any).dayOfMonth ?? 1);
        }
        this.f.startDate.setValue(e.recurrence.startDate ?? '');
        this.f.endDate.setValue(e.recurrence.endDate ?? '');
        this.f.exdates.setValue(e.recurrence.exdates ?? []);
      }

      if (e.roomPlans?.length) {
        const initial: Record<string, RoomPlanVM> = {};
        for (const p of e.roomPlans) {
          initial[p.roomName] = {
            roomName: p.roomName,
            purpose: p.purpose,
            customTitle: p.customTitle ?? null,
            scheduleKind: p.scheduleKind,
            intervalHours: this.asMaybeNumber(p.intervalHours),

            hostSignup:
              p.hostSignup ??
              (p.scheduleKind === RoomScheduleKind.Schedule ? HostSignupLevel.Slot : HostSignupLevel.Room),
            requiresHosts: this.asBoolTri(p.requiresHosts),
            hostScope: p.hostScope ?? null,

            requiresParticipants: this.asBoolTri(p.requiresParticipants),
            participantSignup: null,
            sessionCapacity: this.asMaybeNumber(p.sessionCapacity),

            slots: (p.slots ?? []).map((s) => ({
              startTime: (s.startTime ?? '').slice(0, 5),
              endTime: (s.endTime ?? '').slice(0, 5),
              purpose: s.purpose,
              customTitle: s.customTitle ?? null,
              requiresHosts: this.asBoolTri(s.requiresHosts),
              hostScope: s.hostScope ?? null,

              requiresParticipants: this.asBoolTri(s.requiresParticipants),
              participantSignup: null,
              sessionCapacity: this.asMaybeNumber(s.sessionCapacity),
            })),

            allSlotsRequireHosts: undefined,
          } as RoomPlanVM;
        }
        this.roomPlans.set(initial);
        if (this.f.occurrenceMode.value === 'SINGLE') {
          this.f.attractionType.setValue(AttractionKind.Composite);
        }
      }
    }

    if (!this.isEdit()) {
      this.f.name.valueChanges
        .pipe(startWith(this.f.name.value), takeUntilDestroyed(this.destroyRef))
        .subscribe((val) => this.f.slug.setValue(toSlug(val ?? '')));
    }

    // occurrence validators
    this.f.occurrenceMode.valueChanges
      .pipe(startWith(this.f.occurrenceMode.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => {
        if (mode === 'SINGLE') {
          this.f.singleDate.addValidators([Validators.required]);
          this.f.startDate.clearValidators();
        } else {
          this.f.singleDate.clearValidators();
          this.f.startDate.addValidators([Validators.required]);
          if (this.f.attractionType.value === AttractionKind.Composite) {
            this.f.attractionType.setValue(AttractionKind.Session);
          }
        }
        this.f.singleDate.updateValueAndValidity({ emitEvent: false });
        this.f.startDate.updateValueAndValidity({ emitEvent: false });
      });

    // signup validators
    const applySignupValidators = () => {
      const scope = this.f.participantSignup.value as ParticipantSignupScope;
      this.f.wholeCapacity.clearValidators();
      this.f.sessionCapacity.clearValidators();

      if (scope === ParticipantSignupScope.Whole || scope === ParticipantSignupScope.Both) {
        this.f.wholeCapacity.addValidators([Validators.required, Validators.min(0)]);
      }
      const isEventSession = this.f.attractionType.value === AttractionKind.Session;
      if (isEventSession && (scope === ParticipantSignupScope.Session || scope === ParticipantSignupScope.Both)) {
        this.f.sessionCapacity.addValidators([Validators.required, Validators.min(3), Validators.max(5)]);
      }

      this.f.wholeCapacity.updateValueAndValidity({ emitEvent: false });
      this.f.sessionCapacity.updateValueAndValidity({ emitEvent: false });
    };

    this.f.participantSignup.valueChanges
      .pipe(startWith(this.f.participantSignup.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => applySignupValidators());

    this.f.attractionType.valueChanges
      .pipe(startWith(this.f.attractionType.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => applySignupValidators());

    // recurrence pattern validators + exdates
    this.f.recPattern.valueChanges
      .pipe(startWith(this.f.recPattern.value), takeUntilDestroyed(this.destroyRef))
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
          this.f.dayOfMonth.addValidators([Validators.required, Validators.min(1), Validators.max(31)]);
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

    // tags auto
    const applyTags = () => {
      const tags = new Set<EventTag>();
      if (this.f.isForBeginners.value) tags.add(EventTag.Beginners);

      const kind = this.f.attractionType.value;
      if (kind === AttractionKind.Composite) {
        const plans = this.roomPlans();
        Object.values(plans).forEach((p) => {
          if (p.purpose === RoomPurpose.Session) tags.add(EventTag.Session);
          else if (p.purpose === RoomPurpose.Discussion) tags.add(EventTag.Discussion);
          else if (p.purpose === RoomPurpose.Entertainment) tags.add(EventTag.Entertainment);
        });
      } else {
        switch (kind) {
          case AttractionKind.Session:
            tags.add(EventTag.Session);
            break;
          case AttractionKind.Discussion:
            tags.add(EventTag.Discussion);
            break;
          case AttractionKind.None:
          case AttractionKind.Entertainment:
            tags.add(EventTag.Entertainment);
            break;
        }
      }
      this.f.tags.setValue(Array.from(tags));
    };
    applyTags();

    this.f.isForBeginners.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(applyTags);

    this.f.attractionType.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((val) => {
      if (val === AttractionKind.Composite && this.f.occurrenceMode.value === 'RECURRENT') {
        this.f.occurrenceMode.setValue('SINGLE');
      }
      applyTags();
      const plans = { ...this.roomPlans() };
      Object.keys(plans).forEach((r) => {
        if (plans[r].scheduleKind !== RoomScheduleKind.Schedule) {
          plans[r].purpose = this.defaultPurposeFromEvent();
        }
      });
      this.roomPlans.set(plans);
    });

    this.f.excludeNth.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.rebuildExdates());
    this.f.startDate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.rebuildExdates());
    this.f.endDate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.rebuildExdates());
    this.f.weekday.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.rebuildExdates());
  }

  pickSchedule(room: string, kind: RoomScheduleKind) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;

    p.scheduleKind = kind;
    p.hostSignup = kind === RoomScheduleKind.Schedule ? HostSignupLevel.Slot : HostSignupLevel.Room;

    if (kind === RoomScheduleKind.FullSpan) {
      p.intervalHours = null;
      p.slots = [];
    } else if (kind === RoomScheduleKind.Interval) {
      p.intervalHours = p.intervalHours ?? 1;
      p.slots = [];
    } else if (kind === RoomScheduleKind.Schedule) {
      p.intervalHours = null;

      const defaultCap = this.canHaveSlotCapacity(this.f.participantSignup.value)
        ? this.normalizeCapacityByPurpose(
            p.purpose,
            p.sessionCapacity ?? this.f.sessionCapacity.value ?? (this.purposeIsSession(p.purpose) ? 5 : 0)
          )
        : null;

      p.slots = p.slots?.length
        ? p.slots
        : [
            {
              startTime: this.f.startTime.value || '00:00',
              endTime: this.f.endTime.value || '23:59',
              purpose: p.purpose,
              customTitle: p.customTitle ?? null,
              requiresHosts: p.requiresHosts ?? true,
              hostScope: (p.requiresHosts ?? true) ? p.hostScope ?? HostSignupScope.Staff : null,

              requiresParticipants: p.requiresParticipants ?? null,
              participantSignup: null,
              sessionCapacity: defaultCap,
            },
          ];
    }
    this.roomPlans.set(map);
  }

  setIntervalHours(room: string, raw: string) {
    const val = Math.max(1, Number(raw || 1));
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;
    p.intervalHours = val;
    this.roomPlans.set(map);
  }

  setRoomPurpose(room: string, purpose: RoomPurpose) {
    const map = { ...this.roomPlans() };
    if (!map[room]) return;
    map[room].purpose = purpose;
    this.roomPlans.set(map);
  }

  setRoomRequiresHosts(room: string, requires: boolean) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;
    p.requiresHosts = requires;
    if (requires && !p.hostScope) p.hostScope = HostSignupScope.Staff;
    if (!requires) p.hostScope = null;
    this.roomPlans.set(map);
  }

  setRoomHostScope(room: string, scope: HostSignupScope) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;
    p.hostScope = scope;
    this.roomPlans.set(map);
  }

  // Participants — room level (FullSpan/Interval, defaults for Schedule)
  setRoomRequiresParticipants(room: string, requires: boolean) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;

    p.requiresParticipants = requires ? true : false;
    if (!requires) {
      p.sessionCapacity = null;
    } else {
      const def = this.purposeIsSession(p.purpose) ? (this.f.sessionCapacity.value ?? 5) : 0;
      p.sessionCapacity = this.normalizeCapacityByPurpose(p.purpose, p.sessionCapacity ?? def);
    }
    this.roomPlans.set(map);
  }

  setRoomSessionCapacity(room: string, raw: string) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;
    p.sessionCapacity = this.normalizeCapacityByPurpose(p.purpose, raw);
    this.roomPlans.set(map);
  }

  setRoomTitle(room: string, title: string | null) {
    const map = { ...this.roomPlans() };
    if (!map[room]) return;
    map[room].customTitle = (title ?? '') || null;
    this.roomPlans.set(map);
  }

  toggleAllSlotsRequireHosts(room: string, on: boolean) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p || p.scheduleKind !== RoomScheduleKind.Schedule) return;
    p.allSlotsRequireHosts = on;
    p.slots = (p.slots ?? []).map((s) => ({
      ...s,
      requiresHosts: on,
      hostScope: on ? s.hostScope ?? p.hostScope ?? HostSignupScope.Staff : null,
    }));
    this.roomPlans.set(map);
  }

  addSlot(room: string) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;

    const defaultCap = this.canHaveSlotCapacity(this.f.participantSignup.value)
      ? this.normalizeCapacityByPurpose(
          p.purpose,
          p.sessionCapacity ?? this.f.sessionCapacity.value ?? (this.purposeIsSession(p.purpose) ? 5 : 0)
        )
      : null;

    const reqHosts = p.allSlotsRequireHosts ?? p.requiresHosts ?? true;
    p.slots.push({
      startTime: this.f.startTime.value || '00:00',
      endTime: this.f.endTime.value || '23:59',
      purpose: p.purpose,
      customTitle: p.customTitle ?? null,
      requiresHosts: reqHosts,
      hostScope: reqHosts ? p.hostScope ?? HostSignupScope.Staff : null,

      requiresParticipants: p.requiresParticipants ?? null,
      participantSignup: null,
      sessionCapacity: defaultCap,
    });
    this.roomPlans.set(map);
  }

  removeSlot(room: string, idx: number) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;
    p.slots.splice(idx, 1);
    this.roomPlans.set(map);
  }

  updateSlot(room: string, idx: number, patch: Partial<SlotVM>) {
    const map = { ...this.roomPlans() };
    const p = map[room];
    if (!p) return;
    if (idx >= 0 && idx < p.slots.length) {
      const { participantSignup: _ignored, sessionCapacity, requiresHosts, ...rest } = patch as any;

      const effPurpose = (rest.purpose ?? p.slots[idx].purpose) ?? p.purpose;
      const nextCap = sessionCapacity == null
        ? undefined
        : this.normalizeCapacityByPurpose(effPurpose, sessionCapacity);

      const nextHostScope =
        requiresHosts === false
          ? null
          : requiresHosts === true && (p.slots[idx].hostScope ?? p.hostScope ?? HostSignupScope.Staff);

      p.slots[idx] = {
        ...p.slots[idx],
        ...rest,
        ...(requiresHosts !== undefined ? { requiresHosts } : {}),
        ...(nextCap === undefined ? {} : { sessionCapacity: nextCap }),
        ...(requiresHosts !== undefined ? { hostScope: nextHostScope } : {}),
      };
      this.roomPlans.set(map);
    }
  }

  private validateEntertainmentDetails(): boolean {
    if (this.f.attractionType.value !== AttractionKind.Composite) return true;
    const plans = this.roomPlans();
    for (const p of Object.values(plans)) {
      if (p.purpose === RoomPurpose.Entertainment && !(p.customTitle && p.customTitle.trim())) {
        return false;
      }
      if (p.scheduleKind === RoomScheduleKind.Schedule) {
        for (const s of p.slots) {
          const purpose = s.purpose ?? p.purpose;
          if (purpose === RoomPurpose.Entertainment && !(s.customTitle && s.customTitle.trim())) {
            return false;
          }
        }
      }
    }
    return true;
  }

  submit() {
    if (this.form.invalid) return;

    if (!this.validateEntertainmentDetails()) {
      const ref = this.modal.open(InfoModalComponent, { backdrop: 'static' });
      ref.componentInstance.header = 'Informacja';
      ref.componentInstance.message = 'Dla „Rozrywki” podaj konkrety (np. turniej, Magic, Munchkin) w tytule sali lub slotu.';
      ref.componentInstance.showCancel = false;
      return;
    }

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

    const scope = v.participantSignup as ParticipantSignupScope;
    const signupEnabled = !this.isNone(scope);
    const sessionish = signupEnabled && this.isSessionish(scope);
    const wholeish = signupEnabled && (this.isWhole(scope) || this.isBoth(scope));

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
      hostSignupLevel: v.hostSignupLevel as HostSignupLevel,

      signupRequired: signupEnabled,
      participantSignup: signupEnabled ? scope : ParticipantSignupScope.None,
      wholeCapacity: wholeish ? Number(v.wholeCapacity ?? 0) : null,
      sessionCapacity: sessionish ? Number(v.sessionCapacity ?? 5) : null,

      timezone: 'Europe/Warsaw',
      startTime: v.startTime + ':00',
      endTime: v.endTime + ':00',
      rooms: v.rooms,
      tags: v.tags,
      entryFeePln: Number(v.entryFeePln ?? 0),

      singleDate: v.occurrenceMode === 'SINGLE' ? v.singleDate || undefined : undefined,
      recurrence,
      autoReservation: v.blockSlots,
    } satisfies Omit<EventFull, 'id'>;

    let roomPlansPayload: EventRoomPlan[] | null = null;
    if (v.occurrenceMode === 'SINGLE' && v.attractionType === AttractionKind.Composite) {
      const map = this.roomPlans();

      roomPlansPayload = Object.values(map).map((p) => {
        const allowCapsAtRoom = this.canHaveSlotCapacity(this.f.participantSignup.value);

        const planSessionCapacity = allowCapsAtRoom
          ? this.normalizeCapacityByPurpose(
              p.purpose,
              p.sessionCapacity ?? this.f.sessionCapacity.value ?? (this.purposeIsSession(p.purpose) ? 5 : 0)
            )
          : null;

        const planHostScope = (p.requiresHosts ?? false) ? p.hostScope ?? HostSignupScope.Staff : null;

        return {
          roomName: p.roomName,
          purpose: p.purpose,
          customTitle: p.customTitle ?? null,
          scheduleKind: p.scheduleKind,
          intervalHours: p.scheduleKind === RoomScheduleKind.Interval ? p.intervalHours ?? 1 : null,

          hostSignup:
            p.hostSignup ??
            (p.scheduleKind === RoomScheduleKind.Schedule ? HostSignupLevel.Slot : HostSignupLevel.Room),
          requiresHosts: p.requiresHosts ?? null,
          hostScope: planHostScope,

          requiresParticipants: p.requiresParticipants ?? null,
          participantSignup: null,
          sessionCapacity: planSessionCapacity,

          slots:
            p.scheduleKind === RoomScheduleKind.Schedule
              ? (p.slots || []).map((s) => {
                  const effPurpose = s.purpose ?? p.purpose ?? RoomPurpose.None;
                  const slotAllowCaps = this.canHaveSlotCapacity(this.f.participantSignup.value);
                  const slotReqHosts = s.requiresHosts ?? p.allSlotsRequireHosts ?? p.requiresHosts ?? true;

                  return {
                    startTime: (s.startTime || '00:00') + ':00',
                    endTime: (s.endTime || '00:00') + ':00',
                    purpose: s.purpose,
                    customTitle: s.customTitle ?? null,

                    requiresHosts: slotReqHosts,
                    hostScope: slotReqHosts ? s.hostScope ?? p.hostScope ?? HostSignupScope.Staff : null,
                    hostSignup: null,

                    requiresParticipants: slotAllowCaps
                      ? s.requiresParticipants ?? p.requiresParticipants ?? null
                      : null,
                    participantSignup: null,
                    sessionCapacity: slotAllowCaps
                      ? this.normalizeCapacityByPurpose(
                          effPurpose,
                          s.sessionCapacity ??
                            p.sessionCapacity ??
                            this.f.sessionCapacity.value ??
                            (this.purposeIsSession(effPurpose) ? 5 : 0)
                        )
                      : null,
                  };
                })
              : null,
        } as EventRoomPlan;
      }) as any;
    }

    const payloadFinal = roomPlansPayload ? { ...basePayload, roomPlans: roomPlansPayload } : basePayload;

    const file = this.coverFile();
    const blockSlots = !!v.blockSlots;

    const save$ = this.isEdit()
      ? this.events.updateEvent(this.event()!.id, payloadFinal as Partial<EventFull>, file ?? undefined, 'REPLACE_FUTURE', {
          blockSlots,
        })
      : this.events
          .createEvent(payloadFinal, file ?? undefined, 'REPLACE_FUTURE', { blockSlots })
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
        this.router.navigate(['/auth/events']);
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

  private rebuildExdates() {
    const p = this.form.value.recPattern as RecPattern;
    if (p !== 'WEEKLY_1' && p !== 'WEEKLY_2') {
      this.f.exdates.setValue([]);
      return;
    }
    const nth = this.form.value.excludeNth as ExcludeNth;
    if (nth === ExcludeNth.None) {
      this.f.exdates.setValue([]);
      return;
    }
    const start = this.form.value.startDate || '';
    if (!start) {
      this.f.exdates.setValue([]);
      return;
    }
    const end = this.form.value.endDate || '';
    if (!end) {
      this.f.exdates.setValue([]);
      return;
    }
    const weekday = this.form.value.weekday ?? 4;
    const ex = this.computeExcludedNthWeekdays(start, end, weekday, nth);
    this.f.exdates.setValue(ex);
  }

  private computeExcludedNthWeekdays(startIso: string, endIso: string, weekday0to6: number, nth: ExcludeNth): string[] {
    const out: string[] = [];
    const start = new Date(startIso + 'T00:00:00');
    const end = new Date(endIso + 'T00:00:00');
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cur <= endMonth) {
      const d = this.nthWeekdayOfMonth(cur.getUTCFullYear(), cur.getUTCMonth(), weekday0to6, nth);
      if (d) {
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (local >= start && local <= end) out.push(formatYmdLocal(local));
      }
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }

  private nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date | null {
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

  onAllSlotsRequireHostsChange(room: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement | null)?.checked ?? false;
    this.toggleAllSlotsRequireHosts(room, checked);
  }

  ngOnDestroy(): void {
    const url = this.coverPreviewUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
