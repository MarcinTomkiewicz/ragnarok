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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { format, isValid, parseISO } from 'date-fns';
import { finalize, startWith } from 'rxjs/operators';

import { messageForError, normalizeErrorCode } from '../../../core/enums/errors';
import { RoomScheduleKind } from '../../../core/enums/event-rooms';
import {
  AttractionKind,
  HostSignupScope,
  ParticipantSignupScope,
} from '../../../core/enums/events';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { GmStyleTag } from '../../../core/enums/gm-styles';
import { CoworkerRoles } from '../../../core/enums/roles';
import { IContentTrigger } from '../../../core/interfaces/i-content-trigger';
import {
  IEventHost,
  IEventHostCreate,
  IEventHostUpdate,
} from '../../../core/interfaces/i-event-host';
import { EventFull } from '../../../core/interfaces/i-events';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';
import { EventHostsService } from '../../../core/services/event-hosts/event-hosts.service';
import { EventService } from '../../../core/services/event/event.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';
import { TriggerPickerComponent } from '../../common/trigger-picker/trigger-picker.component';
import { StyleTagsComponent } from '../create-party/style-tags/style-tags.component';
import { SystemsPickerComponent } from '../create-party/systems-picker/systems-picker.component';

type StaffPreviewVM = {
  gmName: string;
  room: string;
  title: string;
  systemName: string;
  styles: GmStyleTag[];
  triggers: string[];
  description: string;
  imageUrl: string | null;
};

@Component({
  selector: 'app-host-signup-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbDropdownModule,
    SystemsPickerComponent,
    StyleTagsComponent,
    TriggerPickerComponent,
  ],
  templateUrl: './host-signup-form.component.html',
  styleUrls: ['./host-signup-form.component.scss'],
})
export class HostSignupFormComponent {
  // services
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backend = inject(BackendService);
  private readonly eventService = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventHostsService = inject(EventHostsService);
  private readonly images = inject(ImageStorageService);

  // Event + occurrence
  readonly eventSignal = signal<EventFull | null>(null);
  readonly occurrenceDateSignal = signal<string | null>(null);

  // URL params (deep-link do sali/slota)
  readonly qpRoom = signal<string | null>(null);
  readonly qpStart = signal<string | null>(null); // 'HH:mm' lub 'HH:mm:ss'
  readonly qpEnd = signal<string | null>(null);

  // Datasets & selections
  readonly signupsSignal = signal<IEventHost[]>([]);
  readonly mySignupSignal = signal<IEventHost | null>(null);
  readonly isStaffSignal = computed<boolean>(() =>
    hasMinimumCoworkerRole(this.auth.user(), CoworkerRoles.Reception)
  );
  readonly selectedRoomForPreviewSignal = signal<string | null>(null);
  readonly gmNameByIdSignal = signal<Map<string, string>>(
    new Map<string, string>()
  );

  // Systems & triggers
  readonly systemsSignal = signal<IRPGSystem[]>([]);
  readonly systemsLoadingSignal = signal<boolean>(false);
  readonly systemNameByIdSignal = computed<Map<string, string>>(
    () =>
      new Map(
        this.systemsSignal().map((system: IRPGSystem) => [
          system.id,
          system.name,
        ])
      )
  );
  readonly triggersSignal = signal<IContentTrigger[]>([]);
  readonly triggersLoadingSignal = signal<boolean>(false);

  // View mirrors for custom pickers
  readonly selectedSystemIdSignal = signal<string>('');
  readonly selectedSystemIdsViewSignal = computed<string[]>(() =>
    this.selectedSystemIdSignal() ? [this.selectedSystemIdSignal()] : []
  );
  readonly playstyleViewSignal = signal<GmStyleTag[]>([]);
  readonly triggersViewSignal = signal<string[]>([]);

  // Rooms taken (uwzględnia blokady zewnętrzne + zgłoszenia, slot-aware dla Composite)
  readonly takenRoomsSignal = signal<Set<string>>(new Set<string>());
  readonly takenLoadingSignal = signal<boolean>(false);

  // Image
  readonly hostImageFileSignal = signal<File | null>(null);
  readonly hostImagePreviewUrlSignal = signal<string | null>(null);
  readonly removeExistingImageSignal = signal<boolean>(false);
  readonly existingImageUrlSignal = computed<string | null>(() => {
    const mine = this.mySignupSignal();
    if (!mine?.imagePath || this.removeExistingImageSignal()) return null;
    return this.imageUrlFrom(mine.imagePath, 800, 450);
  });

  // UI state
  readonly allowFullEditSignal = signal<boolean>(false);
  readonly detailsDisabledSignal = computed<boolean>(
    () => !!this.mySignupSignal() && !this.allowFullEditSignal()
  );
  readonly formattedDateSignal = signal<string>('—');
  readonly loadingSignal = signal<boolean>(true);
  readonly loadErrorSignal = signal<string | null>(null);

  // ===== Helpers =====
  private hhmm(s: string | null | undefined): string {
    const t = (s ?? '').slice(0, 5);
    const [H, M] = t.split(':');
    return `${String(H ?? '00').padStart(2, '0')}:${String(M ?? '00').padStart(
      2,
      '0'
    )}`;
  }
  private sameSlot(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string
  ): boolean {
    return (
      this.hhmm(aStart) === this.hhmm(bStart) &&
      this.hhmm(aEnd) === this.hhmm(bEnd)
    );
  }
  private isSessionPurpose(raw: any): boolean {
    if (raw == null) return false;
    if (typeof raw === 'number')
      return Number(raw) === Number(AttractionKind.Session);
    if (typeof raw === 'string') {
      const v = raw.trim().toUpperCase();
      return v === 'SESSION' || v === 'SESJA';
    }
    return false;
  }

  // --- Sesja vs dyskusja (Composite → po planie/slocie z URL)
  readonly isSessionEventSignal = computed<boolean>(() => {
    const ev = this.eventSignal();
    if (!ev) return false;

    if (ev.attractionType === AttractionKind.Session) return true;
    if (ev.attractionType !== AttractionKind.Composite) return false;

    const room = this.qpRoom();
    const st = this.qpStart();
    const en = this.qpEnd();
    if (!room) return false;

    const plan = ev.roomPlans?.find((p) => p.roomName === room);
    if (!plan) return false;

    if (
      plan.scheduleKind === RoomScheduleKind.FullSpan ||
      plan.scheduleKind === RoomScheduleKind.Interval
    ) {
      return this.isSessionPurpose((plan as any).purpose);
    }

    const slot = (plan.slots ?? []).find((s) =>
      this.sameSlot(s.startTime, s.endTime, st ?? '', en ?? '')
    );
    if (!slot) return false;
    return this.isSessionPurpose(
      (slot as any).purpose ?? (slot as any).attractionKind
    );
  });

  // Czy można edytować pojemność sesji (3–5)
  readonly canEditSessionCapacitySignal = computed<boolean>(() => {
    const ev = this.eventSignal();
    if (!ev) return false;
    if (!this.isSessionEventSignal()) return false;
    return (
      ev.participantSignup === ParticipantSignupScope.Session ||
      ev.participantSignup === ParticipantSignupScope.Both
    );
  });

  // Czy selektor sali jest zablokowany przez slot z URL albo plan Full/Interval+requiresHosts
  readonly lockRoomSignal = computed<boolean>(() => {
    const ev = this.eventSignal();
    const room = this.qpRoom();
    const st = this.qpStart();
    const en = this.qpEnd();
    if (!ev || !room) return false;

    const plan = ev.roomPlans?.find((p) => p.roomName === room) ?? null;
    const fullOrIntervalRequires =
      !!plan &&
      (plan.scheduleKind === RoomScheduleKind.FullSpan ||
        plan.scheduleKind === RoomScheduleKind.Interval) &&
      (plan as any).requiresHosts === true;

    const hasSlot = !!st && !!en;
    return hasSlot || fullOrIntervalRequires;
  });

  // Form
  form = this.formBuilder.nonNullable.group({
    roomName: ['' as string],
    title: ['', [Validators.required]],
    systemId: ['' as string],
    description: [''],
    triggers: [[] as string[]],
    playstyleTags: [[] as GmStyleTag[]],
    sessionCapacity: [5, [Validators.min(3), Validators.max(5)]],
  });

  readonly hostSuccessToast =
    viewChild<TemplateRef<unknown>>('hostSuccessToast');
  readonly hostErrorToast = viewChild<TemplateRef<unknown>>('hostErrorToast');

  constructor() {
    this.destroyRef.onDestroy(() => {
      const prev = this.hostImagePreviewUrlSignal();
      if (prev) URL.revokeObjectURL(prev);
    });
  }

  // ===== lifecycle =====
  ngOnInit(): void {
    // data z paramów
    const dateParam = this.route.snapshot.paramMap.get('date');
    this.occurrenceDateSignal.set(dateParam);
    if (dateParam) {
      const parsed = parseISO(dateParam);
      this.formattedDateSignal.set(
        isValid(parsed) ? format(parsed, 'dd.MM.yyyy') : dateParam
      );
    }

    // initial read of qp
    const qp = this.route.snapshot.queryParamMap;
    this.qpRoom.set(qp.get('room'));
    this.qpStart.set(qp.get('start'));
    this.qpEnd.set(qp.get('end'));

    // keep qp in sync + zastosuj lock/patch sali + redystrybucja mySignup
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.qpRoom.set(q.get('room'));
        this.qpStart.set(q.get('start'));
        this.qpEnd.set(q.get('end'));

        const ev = this.eventSignal();
        this.applyRoomLockFromUrl();

        const currentSignups = this.signupsSignal();
        const picked = this.pickMySignupForContext(currentSignups);
        this.mySignupSignal.set(picked);

        if (ev) this.applyUrlLockAndPrefill(ev);
      });

    // reactive mirrors
    this.form.controls.systemId.valueChanges
      .pipe(startWith(this.form.controls.systemId.value))
      .subscribe((value: string) =>
        this.selectedSystemIdSignal.set(value || '')
      );

    this.form.controls.playstyleTags.valueChanges
      .pipe(startWith(this.form.controls.playstyleTags.value))
      .subscribe((tags: GmStyleTag[]) =>
        this.playstyleViewSignal.set(tags ?? [])
      );

    this.form.controls.triggers.valueChanges
      .pipe(startWith(this.form.controls.triggers.value))
      .subscribe((triggerIds: string[]) =>
        this.triggersViewSignal.set(triggerIds ?? [])
      );

    // load event (resolver or fetch)
    const resolvedEvent = this.route.snapshot.data['event'] as
      | EventFull
      | null
      | undefined;
    if (resolvedEvent) {
      this.finishLoad(resolvedEvent);
    } else {
      const slug = this.route.snapshot.paramMap.get('slug');
      if (!slug) {
        this.loadingSignal.set(false);
        this.loadErrorSignal.set('Brak parametru slug w adresie.');
      } else {
        this.eventService
          .getBySlug(slug)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (event: EventFull | null) => {
              if (!event) {
                this.loadErrorSignal.set('Nie znaleziono wydarzenia.');
                this.loadingSignal.set(false);
                return;
              }
              this.finishLoad(event);
            },
            error: () => {
              this.loadErrorSignal.set('Błąd podczas pobierania wydarzenia.');
              this.loadingSignal.set(false);
            },
          });
      }
    }

    this.selectedSystemIdSignal.set(this.form.controls.systemId.value || '');
    this.playstyleViewSignal.set(this.form.controls.playstyleTags.value ?? []);
    this.triggersViewSignal.set(this.form.controls.triggers.value ?? []);

    this.fetchSystems();
    this.fetchTriggers();
  }

  // ===== load helpers =====
  private finishLoad(event: EventFull): void {
    this.eventSignal.set(event);
    this.loadingSignal.set(false);

    // sterowanie polem capacity
    const capacityControl = this.form.controls.sessionCapacity;
    if (this.canEditSessionCapacitySignal())
      capacityControl.enable({ emitEvent: false });
    else capacityControl.disable({ emitEvent: false });

    // roomName required gdy event ma salki (multi)
    const roomControl = this.form.controls.roomName;
    if (event.rooms?.length) {
      roomControl.addValidators([Validators.required]);
      roomControl.setValue('');
    } else {
      roomControl.clearValidators();
      roomControl.setValue('');
    }
    roomControl.updateValueAndValidity({ emitEvent: false });
    this.applyRoomLockFromUrl();

    const occurrenceDate = this.occurrenceDateSignal();
    if (!occurrenceDate) return;

    this.takenLoadingSignal.set(true);

    this.eventHostsService
      .getHostsWithSystems(event.id, occurrenceDate)
      .pipe(finalize(() => this.takenLoadingSignal.set(false)))
      .subscribe({
        next: (rows: IEventHost[]) => {
          const signups = rows ?? [];
          this.signupsSignal.set(signups);

          // DOBIERZ „moje” zgłoszenie pod aktualny kontekst
          const mySignup = this.pickMySignupForContext(signups);
          this.mySignupSignal.set(mySignup);

          // ===== SLOT-AWARE zajętość z cudzych zgłoszeń =====
          const isComposite = event.attractionType === AttractionKind.Composite;
          const stQP = this.qpStart();
          const enQP = this.qpEnd();
          const slotKey = stQP && enQP ? (this.hhmm(stQP) + ':00') : null;

          const takenFromSignups = new Set<string>();
          for (const s of signups) {
            if (!s.roomName) continue;
            if (mySignup && s.hostUserId === mySignup.hostUserId) continue;

            if (isComposite && slotKey) {
              // tylko kolizje w tym samym slocie
              if ((s.slotStartTime ?? null) === slotKey) {
                takenFromSignups.add(s.roomName);
              }
            } else {
              // tryb room-level (np. non-composite lub brak konkretnego slota w URL)
              takenFromSignups.add(s.roomName);
            }
          }

          // zewnętrzne blokady – już slot-aware (bo przekazujemy st/en)
          const rooms = event.rooms ?? [];
          const st = stQP ?? event.startTime;
          const en = enQP ?? event.endTime;

          this.eventHostsService
            .listExternallyBlockedRooms(event.id, occurrenceDate, rooms, st, en)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (externallyBlocked: Set<string>) => {
                externallyBlocked.forEach((room: string) =>
                  takenFromSignups.add(room)
                );
                this.takenRoomsSignal.set(takenFromSignups);

                if (!mySignup && rooms.length === 1) {
                  this.form.controls.roomName.setValue(rooms[0], {
                    emitEvent: false,
                  });
                }
                // po zebraniu blokad zastosuj ewentualny lock/patch z URL
                this.applyUrlLockAndPrefill(event);
              },
              error: () => {
                this.takenRoomsSignal.set(takenFromSignups);
                if (!mySignup && rooms.length === 1) {
                  this.form.controls.roomName.setValue(rooms[0], {
                    emitEvent: false,
                  });
                }
                this.applyUrlLockAndPrefill(event);
              },
            });

          // Prefill form (edit/new)
          if (mySignup) {
            this.form.patchValue(
              {
                roomName:
                  mySignup.roomName ??
                  (event.rooms?.length === 1 ? event.rooms[0] : ''),
                title: mySignup.title ?? '',
                systemId: mySignup.systemId ?? '',
                description: mySignup.description ?? '',
                triggers: mySignup.triggers ?? [],
                playstyleTags: mySignup.playstyleTags ?? [],
                sessionCapacity: this.clamp(
                  Number(
                    mySignup.sessionCapacity ?? event.sessionCapacity ?? 5
                  ),
                  3,
                  5
                ),
              },
              { emitEvent: false }
            );
            this.syncViewFromForm();
            this.setDetailsEnabled(false);
          } else {
            this.setDetailsEnabled(true);
            this.form.controls.sessionCapacity.setValue(
              this.clamp(Number(event.sessionCapacity ?? 5), 3, 5),
              { emitEvent: false }
            );
            this.syncViewFromForm();
          }
        },
        error: () => {
          this.signupsSignal.set([]);
          this.takenRoomsSignal.set(new Set<string>());
          this.applyUrlLockAndPrefill(event);
        },
      });
  }

  /** znajdź moje zgłoszenie pasujące do aktualnego kontekstu (bez fallbacku, gdy URL określa kontekst) */
  private pickMySignupForContext(signups: IEventHost[]): IEventHost | null {
    const me = this.auth.user();
    if (!me) return null;

    const room = this.qpRoom();
    const start = this.qpStart();
    const end = this.qpEnd();

    // slot z URL -> tylko dokładny match (room + slotStartTime)
    if (room && start && end) {
      const hh = this.hhmm(start);
      const exact = signups.find(
        (s) =>
          s.hostUserId === me.id &&
          s.roomName === room &&
          (s.slotStartTime?.slice(0, 5) ?? '') === hh
      );
      return exact ?? null;
    }

    // tylko salkę z URL -> match po sali bez slota
    if (room) {
      const byRoomNoSlot = signups.find(
        (s) => s.hostUserId === me.id && s.roomName === room && !s.slotStartTime
      );
      return byRoomNoSlot ?? null;
    }

    // brak kontekstu w URL -> pierwszy mój signup (jak dawniej)
    return signups.find((s) => s.hostUserId === me.id) ?? null;
  }

  // ===== URL/plan lock helpers =====
  private canSignupFor(
    ev: EventFull,
    roomName: string,
    start?: string | null,
    end?: string | null
  ): boolean {
    const plans = ev.roomPlans ?? [];
    if (!plans.length) return (ev.rooms ?? []).includes(roomName);

    const plan = plans.find((p) => p.roomName === roomName);
    if (!plan) return false;

    if (
      plan.scheduleKind === RoomScheduleKind.FullSpan ||
      plan.scheduleKind === RoomScheduleKind.Interval
    ) {
      return (plan as any).requiresHosts === true;
    }

    const slots = plan.slots ?? [];
    if (start && end) {
      const slot = slots.find((s) =>
        this.sameSlot(s.startTime, s.endTime, start, end)
      );
      if (!slot) return false;
      return (slot as any).requiresHosts === true;
    }
    return slots.some((s) => (s as any).requiresHosts === true);
  }

  private applyUrlLockAndPrefill(ev: EventFull): void {
    const room = this.qpRoom();
    const st = this.qpStart();
    const en = this.qpEnd();
    const c = this.form.controls.roomName;

    const plan = room
      ? ev.roomPlans?.find((p) => p.roomName === room) ?? null
      : null;

    const isFullOrInterval =
      !!plan &&
      (plan.scheduleKind === RoomScheduleKind.FullSpan ||
        plan.scheduleKind === RoomScheduleKind.Interval) &&
      (plan as any).requiresHosts === true;

    const hasSlot = !!st && !!en;

    if (room && this.canSignupFor(ev, room, st, en)) {
      if (hasSlot || isFullOrInterval) {
        c.setValue(room, { emitEvent: false });
        c.disable({ emitEvent: false });
      } else {
        if (!this.isRoomTaken(room)) c.setValue(room, { emitEvent: false });
        c.enable({ emitEvent: false });
      }
    } else {
      c.enable({ emitEvent: false });
    }

    // Jeśli w nowym kontekście nie mamy własnego zgłoszenia – wyczyść pola
    const mine = this.mySignupSignal();
    if (!mine) {
      this.form.patchValue(
        {
          title: '',
          systemId: '',
          description: '',
          triggers: [],
          playstyleTags: [],
        },
        { emitEvent: false }
      );
      this.syncViewFromForm();
    }
  }

  // ===== datasets =====
  private fetchSystems(): void {
    this.systemsLoadingSignal.set(true);
    this.backend
      .getAll<IRPGSystem>(
        'systems',
        'name',
        'asc',
        undefined,
        undefined,
        undefined,
        false
      )
      .pipe(
        finalize(() => this.systemsLoadingSignal.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows: IRPGSystem[] | null) => this.systemsSignal.set(rows ?? []),
        error: () => this.systemsSignal.set([]),
      });
  }

  private fetchTriggers(): void {
    this.triggersLoadingSignal.set(true);
    this.backend
      .getAll<IContentTrigger>(
        'content_triggers',
        'label',
        'asc',
        {
          filters: { is_active: { operator: FilterOperator.EQ, value: true } },
        } as unknown as any,
        undefined,
        undefined,
        false
      )
      .pipe(finalize(() => this.triggersLoadingSignal.set(false)))
      .subscribe({
        next: (rows: IContentTrigger[] | null) =>
          this.triggersSignal.set(rows ?? []),
        error: () => this.triggersSignal.set([]),
      });
  }

  // ===== UI helpers =====
  private clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  selectedRoomLabel(): string {
    const event = this.eventSignal();
    if (!event?.rooms?.length) return 'Brak salek';

    const locked = this.lockRoomSignal();
    const urlRoom = this.qpRoom();

    if (locked && urlRoom) return `${urlRoom} (zablokowana przez slot/plan)`;
    if (event.rooms.length === 1) return event.rooms[0];

    const selectedRoom = this.form.value.roomName;
    if (!selectedRoom) {
      const allTaken = event.rooms.every((room: string) =>
        this.takenRoomsSignal().has(room)
      );
      return allTaken ? 'Brak wolnych salek' : 'Wybierz salkę';
    }
    return selectedRoom;
  }

  isRoomTaken(room: string): boolean {
    const mySignup = this.mySignupSignal();
    if (mySignup && mySignup.roomName === room) return false;
    return this.takenRoomsSignal().has(room);
  }

  allRoomsTaken(): boolean {
    const event = this.eventSignal();
    if (!event?.rooms?.length) return false;
    return event.rooms.every((room: string) =>
      this.takenRoomsSignal().has(room)
    );
  }

  pickRoom(room: string): void {
    if (this.lockRoomSignal()) return; // zablokowane przez URL/plan
    if (this.isRoomTaken(room)) return;
    this.form.controls.roomName.setValue(room);
  }

  pickRoomForPreview(room: string): void {
    this.selectedRoomForPreviewSignal.set(room);
    // synchro z URL (tylko podgląd, bez wpływu na form lock)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { room },
      queryParamsHandling: 'merge',
    });
  }

  get canSignup(): boolean {
    const user = this.auth.user();
    const event = this.eventSignal();
    if (!user || !event) return false;
    if (event.hostSignup === HostSignupScope.Any) return true;
    return hasMinimumCoworkerRole(user, CoworkerRoles.Gm);
  }

  onSystemsChange(ids: string[]): void {
    this.form.controls.systemId.setValue(ids[0] ?? '');
  }

  playstyleSelected(): GmStyleTag[] {
    const selected = this.form.value.playstyleTags ?? [];
    const allowed = new Set<GmStyleTag>(Object.values(GmStyleTag));
    return selected.filter((tag: GmStyleTag): tag is GmStyleTag =>
      allowed.has(tag as GmStyleTag)
    );
  }

  onStyleTagsChange(tags: GmStyleTag[]): void {
    this.form.controls.playstyleTags.setValue(tags);
  }

  onImageChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.hostImageFileSignal.set(file);
    const prev = this.hostImagePreviewUrlSignal();
    if (prev) URL.revokeObjectURL(prev);
    this.hostImagePreviewUrlSignal.set(file ? URL.createObjectURL(file) : null);
    if (file) this.removeExistingImageSignal.set(false);
  }

  clearNewImage(): void {
    const prev = this.hostImagePreviewUrlSignal();
    if (prev) URL.revokeObjectURL(prev);
    this.hostImagePreviewUrlSignal.set(null);
    this.hostImageFileSignal.set(null);
  }

  removeExistingImage(): void {
    this.removeExistingImageSignal.set(true);
    this.clearNewImage();
  }

  enableDetailsEdit(): void {
    this.allowFullEditSignal.set(true);
    this.setDetailsEnabled(true);
    this.syncViewFromForm();
  }

  cancelDetailsEdit(): void {
    const mySignup = this.mySignupSignal();
    const event = this.eventSignal();
    if (mySignup) {
      this.form.patchValue(
        {
          roomName:
            mySignup.roomName ?? (event?.rooms?.length === 1 ? event.rooms[0] : ''),
          title: mySignup.title ?? '',
          systemId: mySignup.systemId ?? '',
          description: mySignup.description ?? '',
          triggers: mySignup.triggers ?? [],
          playstyleTags: mySignup.playstyleTags ?? [],
          sessionCapacity: this.clamp(
            Number(mySignup.sessionCapacity ?? event?.sessionCapacity ?? 5),
            3,
            5
          ),
        },
        { emitEvent: false }
      );
    }
    this.clearNewImage();
    this.removeExistingImageSignal.set(false);
    this.allowFullEditSignal.set(false);
    this.setDetailsEnabled(false);
    this.syncViewFromForm();
  }

  private setDetailsEnabled(enabled: boolean): void {
    const c = this.form.controls;
    const op: 'enable' | 'disable' = enabled ? 'enable' : 'disable';
    c.title[op]({ emitEvent: false });
    c.systemId[op]({ emitEvent: false });
    c.description[op]({ emitEvent: false });
    c.triggers[op]({ emitEvent: false });
    c.playstyleTags[op]({ emitEvent: false });
    c.sessionCapacity[op]({ emitEvent: false });
  }

  private syncViewFromForm(): void {
    this.selectedSystemIdSignal.set(this.form.controls.systemId.value || '');
    this.playstyleViewSignal.set(this.form.controls.playstyleTags.value ?? []);
    this.triggersViewSignal.set(this.form.controls.triggers.value ?? []);
  }

  // ===== actions =====
  goBack(): void {
    this.router.navigate(['/auth/events']);
  }

  submit(): void {
    const event = this.eventSignal();
    const occurrenceDate = this.occurrenceDateSignal();
    if (!event || !occurrenceDate) return;
    if (!this.canSignup) return;

    // przy multi-room bez locka – musi być wskazana sala
    if (event.rooms?.length) {
      if (this.allRoomsTaken()) return;
      if (
        event.rooms.length > 1 &&
        !this.form.value.roomName &&
        !this.lockRoomSignal()
      ) {
        return;
      }
    }

    const mySignup = this.mySignupSignal();
    const user = this.auth.user()!;
    const formValue = this.form.getRawValue();
    const isSession = this.isSessionEventSignal();

    const roomParam = this.qpRoom();
    const startParam = this.qpStart();
    const endParam = this.qpEnd();

    const plan = roomParam
      ? event.roomPlans?.find((p) => p.roomName === roomParam) ?? null
      : null;

    const locked =
      (!!roomParam && !!startParam && !!endParam) ||
      (!!plan &&
        (plan.scheduleKind === RoomScheduleKind.FullSpan ||
          plan.scheduleKind === RoomScheduleKind.Interval) &&
        (plan as any).requiresHosts === true);

    const lockedRoom = locked ? roomParam ?? null : null;

    const resolvedRoom =
      lockedRoom ??
      (event.rooms?.length
        ? event.rooms.length === 1
          ? event.rooms[0]
          : formValue.roomName
        : null);

    const canSetCapacity = this.canEditSessionCapacitySignal();
    const capacity = canSetCapacity
      ? this.clamp(
          Number(formValue.sessionCapacity ?? event.sessionCapacity ?? 5),
          3,
          5
        )
      : undefined;

    const slotStartTime =
      !!startParam && !!endParam ? this.hhmm(startParam) + ':00' : null;

    if (mySignup) {
      const allow = this.allowFullEditSignal();
      const patch: IEventHostUpdate = {
        roomName: resolvedRoom || null,
        ...(slotStartTime ? { slotStartTime } : {}),
      };

      if (allow) {
        patch.title = formValue.title;
        if (isSession) {
          patch.systemId = formValue.systemId || null;
          patch.description = formValue.description || null;
          patch.triggers = formValue.triggers ?? [];
          patch.playstyleTags = formValue.playstyleTags ?? [];
          if (canSetCapacity && capacity !== undefined)
            patch.sessionCapacity = capacity;
        } else {
          patch.systemId = null;
          patch.triggers = [];
          patch.playstyleTags = [];
          patch.description = formValue.description || null;
        }
        const file = this.hostImageFileSignal();
        if (file) patch.imageFile = file;
        else if (this.removeExistingImageSignal()) patch.imagePath = null;
      }

      this.eventHostsService.updateHost(mySignup.id, patch).subscribe({
        next: () => this.afterSaveSuccess(),
        error: (err: unknown) => this.afterSaveError(err),
      });
      return;
    }

    const file = this.hostImageFileSignal();
    const payload: IEventHostCreate = {
      eventId: event.id,
      occurrenceDate,
      roomName: event.rooms?.length ? resolvedRoom : null,
      ...(slotStartTime ? { slotStartTime } : {}),
      hostUserId: user.id,
      role: event.hostSignup,
      title: formValue.title,
      systemId: isSession ? formValue.systemId || null : null,
      description: formValue.description || null,
      triggers: isSession ? formValue.triggers ?? [] : [],
      playstyleTags: isSession ? formValue.playstyleTags ?? [] : [],
      imageFile: file ?? null,
      ...(canSetCapacity && capacity !== undefined
        ? { sessionCapacity: capacity }
        : {}),
    };

    this.eventHostsService.createSignup(payload).subscribe({
      next: () => this.afterSaveSuccess(),
      error: (err: unknown) => this.afterSaveError(err),
    });
  }

  resign(): void {
    const mySignup = this.mySignupSignal();
    if (!mySignup) return;
    this.eventHostsService.deleteHost(mySignup.id).subscribe({
      next: () => this.afterSaveSuccess(),
      error: (err: unknown) => this.afterSaveError(err),
    });
  }

  private afterSaveSuccess(): void {
    const tpl = this.hostSuccessToast();
    if (tpl)
      this.toast.show({
        template: tpl,
        classname: 'bg-success text-white',
        header: 'Zapisano zgłoszenie',
      });
    this.router.navigate(['/auth/events']);
  }

  private afterSaveError(err: unknown): void {
    const tpl = this.hostErrorToast();
    if (!tpl) return;
    const header = messageForError(normalizeErrorCode(err));
    this.toast.show({
      template: tpl,
      classname: 'bg-danger text-white',
      header,
    });
  }

  // ===== misc =====
  private imageUrlFrom(path?: string | null, w = 800, h = 450): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return this.images.getOptimizedPublicUrl(path, w, h);
  }

  readonly staffPreviewViewModelSignal = computed<StaffPreviewVM | null>(() => {
    const selected = this.staffSelectedSignupSignal();
    if (!selected) return null;
    const systemName =
      this.systemNameByIdSignal().get(selected.systemId ?? '') ?? '—';
    const gmName =
      this.gmNameByIdSignal().get(selected.hostUserId) ?? selected.hostUserId;
    const imageUrl = this.imageUrlFrom(selected.imagePath, 640, 400);
    return {
      gmName,
      room: selected.roomName ?? '—',
      title: selected.title || '—',
      systemName,
      styles: selected.playstyleTags ?? [],
      triggers: selected.triggers ?? [],
      description: selected.description ?? '',
      imageUrl,
    };
  });

  private readonly staffSelectedSignupSignal = computed<IEventHost | null>(
    () => {
      const room = this.selectedRoomForPreviewSignal();
      if (!room) return null;
      const list = this.signupsSignal();
      for (let i = 0; i < list.length; i++)
        if (list[i]?.roomName === room) return list[i];
      return null;
    }
  );

  private applyRoomLockFromUrl(): void {
    const roomCtrl = this.form.controls.roomName;
    const room = this.qpRoom();
    const start = this.qpStart();
    const end = this.qpEnd();
    const lockedBySlot = !!room && !!start && !!end;

    if (lockedBySlot) {
      roomCtrl.setValue(room!, { emitEvent: false });
      roomCtrl.disable({ emitEvent: false });
    } else {
      roomCtrl.enable({ emitEvent: false });
      // przy wielu salkach nadal wymagamy wyboru
      const ev = this.eventSignal();
      const needRoom = (ev?.rooms?.length ?? 0) > 1;
      if (needRoom) {
        roomCtrl.addValidators([Validators.required]);
      } else {
        roomCtrl.clearValidators();
      }
      roomCtrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  /** Czy przycisk Submit powinien być wyłączony. */
  shouldButtonDisable(): boolean {
    const ev = this.eventSignal();
    if (!ev) return true;

    const urlRoom = this.qpRoom();
    const urlStart = this.qpStart();
    const urlEnd = this.qpEnd();
    const lockedBySlot = !!urlRoom && !!urlStart && !!urlEnd;

    const effectiveRoom: string | null = lockedBySlot
      ? (urlRoom as string)
      : ev.rooms?.length
      ? ev.rooms.length === 1
        ? ev.rooms[0]
        : this.form.getRawValue().roomName || null
      : null;

    const needRoom = (ev.rooms?.length ?? 0) > 1;
    const roomMissing = needRoom && !effectiveRoom;

    const taken = effectiveRoom
      ? this.isRoomTaken(effectiveRoom)
      : (ev.rooms?.length ?? 0) > 0
      ? this.allRoomsTaken()
      : false;

    const can = this.canSignup;

    const disabled = !can || taken || roomMissing || this.form.invalid;
    return disabled;
  }
}
