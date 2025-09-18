// host-signup-form.component.ts
import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { format, isValid, parseISO } from 'date-fns';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { finalize, startWith } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { EventService } from '../../../core/services/event/event.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AttractionKind, HostSignupScope } from '../../../core/enums/events';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { GmStyleTag } from '../../../core/enums/gm-styles';
import { CoworkerRoles } from '../../../core/enums/roles';
import { IContentTrigger } from '../../../core/interfaces/i-content-trigger';
import { EventFull } from '../../../core/interfaces/i-events';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';
import { TriggerPickerComponent } from '../../common/trigger-picker/trigger-picker.component';
import { StyleTagsComponent } from '../create-party/style-tags/style-tags.component';
import { SystemsPickerComponent } from '../create-party/systems-picker/systems-picker.component';
import { messageForError, normalizeErrorCode } from '../../../core/enums/errors';
import { IEventHost, IEventHostCreate } from '../../../core/interfaces/i-event-host';
import { EventHostsService } from '../../../core/services/event-hosts/event-hosts.service';
import { GmDirectoryService } from '../../core/services/gm/gm-directory/gm-directory.service';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';

@Component({
  selector: 'app-host-signup-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDropdownModule, SystemsPickerComponent, StyleTagsComponent, TriggerPickerComponent],
  templateUrl: './host-signup-form.component.html',
  styleUrls: ['./host-signup-form.component.scss'],
})
export class HostSignupFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backend = inject(BackendService);
  private readonly events = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hosts = inject(EventHostsService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly images = inject(ImageStorageService);

  readonly evSig = signal<EventFull | null>(null);
  readonly isSessionSig = computed(() => this.evSig()?.attractionType === AttractionKind.Session);

  readonly dateSig = signal<string | null>(null);
  readonly signupsSig = signal<IEventHost[]>([]);
  readonly mySignupSig = signal<IEventHost | null>(null);

  readonly isStaffSig = computed(() => hasMinimumCoworkerRole(this.auth.user(), CoworkerRoles.Reception));
  readonly selectedRoomViewSig = signal<string | null>(null);
  readonly gmNameByIdSig = signal<Map<string, string>>(new Map());

  readonly systemsSig = signal<IRPGSystem[]>([]);
  readonly systemsLoadingSig = signal(false);
  readonly systemNameByIdSig = computed(() => new Map(this.systemsSig().map(s => [s.id, s.name])));
  readonly triggersSig = signal<IContentTrigger[]>([]);
  readonly triggersLoadingSig = signal(false);

  readonly systemIdViewSig = signal<string>('');
  readonly selectedSystemIdsView = computed(() => (this.systemIdViewSig() ? [this.systemIdViewSig()] : []));
  readonly playstyleViewSig = signal<GmStyleTag[]>([]);
  readonly triggersViewSig = signal<string[]>([]);

  readonly takenRoomsSig = signal<Set<string>>(new Set());
  readonly takenLoadingSig = signal(false);

  readonly hostImageFileSig = signal<File | null>(null);
  readonly hostImagePreviewUrlSig = signal<string | null>(null);
  readonly removeExistingImageSig = signal(false);
  readonly existingImageUrlSig = computed<string | null>(() => {
    const mine = this.mySignupSig();
    if (!mine?.imagePath || this.removeExistingImageSig()) return null;
    return this.imageUrlFrom(mine.imagePath, 800, 450);
  });

  readonly allowFullEditSig = signal(false);
  readonly detailsDisabledSig = computed(() => !!this.mySignupSig() && !this.allowFullEditSig());

  readonly formattedDateSig = signal('—');
  readonly loadingSig = signal(true);
  readonly loadErrorSig = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    roomName: ['' as string],
    title: ['', [Validators.required]],
    systemId: ['' as string],
    description: [''],
    triggers: [[] as string[]],
    playstyleTags: [[] as GmStyleTag[]],
  });

  readonly hostSuccessToast = viewChild<TemplateRef<unknown>>('hostSuccessToast');
  readonly hostErrorToast = viewChild<TemplateRef<unknown>>('hostErrorToast');

  constructor() {
    this.destroyRef.onDestroy(() => {
      const prev = this.hostImagePreviewUrlSig();
      if (prev) URL.revokeObjectURL(prev);
    });
  }

  ngOnInit() {
    const dateParam = this.route.snapshot.paramMap.get('date');
    this.dateSig.set(dateParam);
    if (dateParam) {
      const d = parseISO(dateParam);
      this.formattedDateSig.set(isValid(d) ? format(d, 'dd.MM.yyyy') : dateParam);
    }

    this.form.controls.systemId.valueChanges.pipe(startWith(this.form.controls.systemId.value ?? '')).subscribe(v => this.systemIdViewSig.set(v || ''));
    this.form.controls.playstyleTags.valueChanges.pipe(startWith(this.form.controls.playstyleTags.value ?? [])).subscribe(v => this.playstyleViewSig.set((v ?? []) as GmStyleTag[]));
    this.form.controls.triggers.valueChanges.pipe(startWith(this.form.controls.triggers.value ?? [])).subscribe(v => this.triggersViewSig.set((v ?? []) as string[]));

    const resolved = this.route.snapshot.data['event'] as EventFull | null | undefined;
    if (resolved) {
      this.finishLoad(resolved);
    } else {
      const slug = this.route.snapshot.paramMap.get('slug');
      if (!slug) {
        this.loadingSig.set(false);
        this.loadErrorSig.set('Brak parametru slug w adresie.');
      } else {
        this.events.getBySlug(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: ev => {
            if (!ev) {
              this.loadErrorSig.set('Nie znaleziono wydarzenia.');
              this.loadingSig.set(false);
              return;
            }
            this.finishLoad(ev);
          },
          error: () => {
            this.loadErrorSig.set('Błąd podczas pobierania wydarzenia.');
            this.loadingSig.set(false);
          },
        });
      }
    }

    this.systemIdViewSig.set(this.form.controls.systemId.value || '');
    this.playstyleViewSig.set(this.form.controls.playstyleTags.value ?? []);
    this.triggersViewSig.set(this.form.controls.triggers.value ?? []);

    this.fetchSystems();
    this.fetchTriggers();
  }

  private finishLoad(ev: EventFull) {
    this.evSig.set(ev);
    this.loadingSig.set(false);

    const roomCtrl = this.form.controls.roomName;
    if (ev.rooms?.length) {
      roomCtrl.addValidators([Validators.required]);
      // wstępnie wyczyść – ustawimy zaraz właściwą wartość
      roomCtrl.setValue('');
    } else {
      roomCtrl.clearValidators();
      roomCtrl.setValue('');
    }
    roomCtrl.updateValueAndValidity({ emitEvent: false });

    const date = this.dateSig();
    if (!date) return;

    this.takenLoadingSig.set(true);
    this.hosts.getHostsWithSystems(ev.id, date).pipe(finalize(() => this.takenLoadingSig.set(false))).subscribe({
      next: (rows: any[]) => {
        const signups = (rows ?? []) as IEventHost[];
        this.signupsSig.set(signups);

        const me = this.auth.user();
        const mine = me ? signups.find(s => s.hostUserId === me.id) ?? null : null;
        this.mySignupSig.set(mine);

        const takenFromSignups = new Set<string>(
          signups
            .filter(s => !!s.roomName && (!mine || s.hostUserId !== mine.hostUserId))
            .map(s => s.roomName as string)
        );

        const rooms = ev.rooms ?? [];
        this.hosts
          .listExternallyBlockedRooms(ev.id, date, rooms, ev.startTime, ev.endTime)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (ext) => {
              ext.forEach((r) => takenFromSignups.add(r));
              this.takenRoomsSig.set(takenFromSignups);

              // auto-wybór jedynej salki (jeśli nie mam już zgłoszenia)
              if (!mine && rooms.length === 1) {
                this.form.controls.roomName.setValue(rooms[0], { emitEvent: false });
              }
            },
            error: () => {
              this.takenRoomsSig.set(takenFromSignups);
              if (!mine && rooms.length === 1) {
                this.form.controls.roomName.setValue(rooms[0], { emitEvent: false });
              }
            },
          });

        if (this.isStaffSig()) {
          this.selectedRoomViewSig.set(signups[0]?.roomName ?? null);
          const ids = Array.from(new Set(signups.map(s => s.hostUserId)));
          if (ids.length) {
            forkJoin(ids.map(id => this.gmDirectory.getGmById(id)))
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (gms: (IGmData | null)[]) => {
                  const map = new Map<string, string>();
                  gms.forEach(gm => {
                    if (!gm) return;
                    map.set(gm.userId, this.gmDirectory.gmDisplayName(gm));
                  });
                  this.gmNameByIdSig.set(map);
                },
                error: () => this.gmNameByIdSig.set(new Map()),
              });
          }
        }

        if (mine) {
          this.form.patchValue(
            {
              roomName: mine.roomName ?? (ev.rooms?.length === 1 ? ev.rooms[0] : ''),
              title: mine.title ?? '',
              systemId: mine.systemId ?? '',
              description: mine.description ?? '',
              triggers: mine.triggers ?? [],
              playstyleTags: mine.playstyleTags ?? [],
            },
            { emitEvent: false }
          );
          this.syncViewFromForm();
          this.setDetailsEnabled(false);
        } else {
          // nowy zapis – pola edytowalne, a single-room już ustawione wyżej
          this.setDetailsEnabled(true);
          this.syncViewFromForm();
        }
      },
      error: () => {
        this.signupsSig.set([]);
        this.takenRoomsSig.set(new Set());
      },
    });
  }

  private fetchSystems() {
    this.systemsLoadingSig.set(true);
    this.backend
      .getAll<IRPGSystem>('systems', 'name', 'asc', undefined, undefined, undefined, false)
      .pipe(finalize(() => this.systemsLoadingSig.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => this.systemsSig.set(rows ?? []),
        error: () => this.systemsSig.set([]),
      });
  }

  private fetchTriggers() {
    this.triggersLoadingSig.set(true);
    this.backend
      .getAll<IContentTrigger>(
        'content_triggers',
        'label',
        'asc',
        { filters: { is_active: { operator: FilterOperator.EQ, value: true } } } as any,
        undefined,
        undefined,
        false
      )
      .pipe(finalize(() => this.triggersLoadingSig.set(false)))
      .subscribe({
        next: rows => this.triggersSig.set(rows ?? []),
        error: () => this.triggersSig.set([]),
      });
  }

  selectedRoomLabel(): string {
    const ev = this.evSig();
    const v = this.form.value.roomName;
    if (!ev?.rooms?.length) return 'Brak salek';
    if (ev.rooms.length === 1) return ev.rooms[0];
    if (!v) {
      const allTaken = ev.rooms.every(r => this.takenRoomsSig().has(r));
      return allTaken ? 'Brak wolnych salek' : 'Wybierz salkę';
    }
    return v;
  }
  isRoomTaken(r: string): boolean {
    const mine = this.mySignupSig();
    if (mine && mine.roomName === r) return false;
    return this.takenRoomsSig().has(r);
  }
  allRoomsTaken(): boolean {
    const ev = this.evSig();
    if (!ev?.rooms?.length) return false;
    return ev.rooms.every(r => this.takenRoomsSig().has(r));
  }
  pickRoom(r: string) {
    if (this.isRoomTaken(r)) return;
    this.form.controls.roomName.setValue(r);
  }
  pickRoomView(r: string) {
    this.selectedRoomViewSig.set(r);
  }

  get canSignup(): boolean {
    const user = this.auth.user();
    const ev = this.evSig();
    if (!user || !ev) return false;
    if (ev.hostSignup === HostSignupScope.Any) return true;
    return hasMinimumCoworkerRole(user, CoworkerRoles.Gm);
  }

  onSystemsChange(ids: string[]) {
    this.form.controls.systemId.setValue(ids[0] ?? '');
  }
  playstyleSelected(): GmStyleTag[] {
    const v = this.form.value.playstyleTags ?? [];
    const all = new Set(Object.values(GmStyleTag));
    return v.filter((t): t is GmStyleTag => all.has(t as GmStyleTag));
  }
  onStyleTagsChange(tags: GmStyleTag[]) {
    this.form.controls.playstyleTags.setValue(tags);
  }

  onImageChange(ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.hostImageFileSig.set(file);
    const prev = this.hostImagePreviewUrlSig();
    if (prev) URL.revokeObjectURL(prev);
    this.hostImagePreviewUrlSig.set(file ? URL.createObjectURL(file) : null);
    if (file) this.removeExistingImageSig.set(false);
  }
  clearNewImage() {
    const prev = this.hostImagePreviewUrlSig();
    if (prev) URL.revokeObjectURL(prev);
    this.hostImagePreviewUrlSig.set(null);
    this.hostImageFileSig.set(null);
  }
  removeExistingImage() {
    this.removeExistingImageSig.set(true);
    this.clearNewImage();
  }

  enableDetailsEdit() {
    this.allowFullEditSig.set(true);
    this.setDetailsEnabled(true);
    this.syncViewFromForm();
  }
  cancelDetailsEdit() {
    const mine = this.mySignupSig();
    const ev = this.evSig();
    if (mine) {
      this.form.patchValue(
        {
          roomName: mine.roomName ?? (ev?.rooms?.length === 1 ? ev.rooms[0] : ''),
          title: mine.title ?? '',
          systemId: mine.systemId ?? '',
          description: mine.description ?? '',
          triggers: mine.triggers ?? [],
          playstyleTags: mine.playstyleTags ?? [],
        },
        { emitEvent: false }
      );
    }
    this.clearNewImage();
    this.removeExistingImageSig.set(false);
    this.allowFullEditSig.set(false);
    this.setDetailsEnabled(false);
    this.syncViewFromForm();
  }
  private setDetailsEnabled(enabled: boolean) {
    const c = this.form.controls;
    const ops: 'enable' | 'disable' = enabled ? 'enable' : 'disable';
    c.title[ops]({ emitEvent: false });
    c.systemId[ops]({ emitEvent: false });
    c.description[ops]({ emitEvent: false });
    c.triggers[ops]({ emitEvent: false });
    c.playstyleTags[ops]({ emitEvent: false });
  }
  private syncViewFromForm() {
    this.systemIdViewSig.set(this.form.controls.systemId.value || '');
    this.playstyleViewSig.set(this.form.controls.playstyleTags.value ?? []);
    this.triggersViewSig.set(this.form.controls.triggers.value ?? []);
  }

  goBack() {
    this.router.navigate(['/auth/events']);
  }

  submit() {
    const ev = this.evSig();
    const date = this.dateSig();
    if (!ev || !date) return;
    if (!this.canSignup) return;

    if (ev.rooms?.length) {
      if (this.allRoomsTaken()) return;
      if (ev.rooms.length > 1 && !this.form.value.roomName) return;
    }

    const mine = this.mySignupSig();
    const user = this.auth.user()!;
    const v = this.form.getRawValue();
    const isSession = this.isSessionSig();

    const resolvedRoom =
      ev.rooms?.length ? (ev.rooms.length === 1 ? ev.rooms[0] : v.roomName) : null;

    if (mine) {
      const allow = this.allowFullEditSig();
      const patch: any = { roomName: resolvedRoom || null };

      if (allow) {
        patch.title = v.title;
        if (isSession) {
          patch.systemId = v.systemId || null;
          patch.description = v.description || null;
          patch.triggers = v.triggers ?? [];
          patch.playstyleTags = v.playstyleTags ?? [];
        } else {
          patch.systemId = null;
          patch.triggers = [];
          patch.playstyleTags = [];
          patch.description = v.description || null;
        }
        const file = this.hostImageFileSig();
        if (file) patch.imageFile = file;
        else if (this.removeExistingImageSig()) patch.imagePath = null;
      }

      this.hosts.updateHost(mine.id, patch).subscribe({
        next: () => this.afterSaveSuccess(),
        error: err => this.afterSaveError(err),
      });
      return;
    }

    const file = this.hostImageFileSig();
    const payload: IEventHostCreate = {
      eventId: ev.id,
      occurrenceDate: date,
      roomName: ev.rooms?.length ? resolvedRoom : null,
      hostUserId: user.id,
      role: ev.hostSignup,
      title: v.title,
      systemId: isSession ? (v.systemId || null) : null,
      description: v.description || null,
      triggers: isSession ? (v.triggers ?? []) : [],
      playstyleTags: isSession ? (v.playstyleTags ?? []) : [],
      imageFile: file ?? null,
    };

    this.hosts.createSignup(payload).subscribe({
      next: () => this.afterSaveSuccess(),
      error: err => this.afterSaveError(err),
    });
  }

  resign() {
    const mine = this.mySignupSig();
    if (!mine) return;
    this.hosts.deleteHost(mine.id).subscribe({
      next: () => this.afterSaveSuccess(),
      error: err => this.afterSaveError(err),
    });
  }

  private afterSaveSuccess() {
    const tpl = this.hostSuccessToast();
    if (tpl) this.toast.show({ template: tpl, classname: 'bg-success text-white', header: 'Zapisano zgłoszenie' });
    this.router.navigate(['/auth/events']);
  }
  private afterSaveError(err: unknown) {
    const tpl = this.hostErrorToast();
    if (!tpl) return;
    const header = messageForError(normalizeErrorCode(err));
    this.toast.show({ template: tpl, classname: 'bg-danger text-white', header });
  }

  private imageUrlFrom(path?: string | null, w = 800, h = 450): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return this.images.getOptimizedPublicUrl(path, w, h);
  }

  readonly staffVmSig = computed(() => {
    const s = this.staffSelectedSignupSig();
    if (!s) return null;
    const sys = this.systemNameByIdSig().get(s.systemId ?? '') ?? '—';
    const gm = this.gmNameByIdSig().get(s.hostUserId) ?? s.hostUserId;
    const img = this.imageUrlFrom(s.imagePath, 640, 400);
    return { gmName: gm, room: s.roomName ?? '—', title: s.title || '—', systemName: sys, styles: s.playstyleTags ?? [], triggers: s.triggers ?? [], description: s.description ?? '', imageUrl: img };
  });
  private readonly staffSelectedSignupSig = computed<IEventHost | null>(() => {
    const room = this.selectedRoomViewSig();
    if (!room) return null;
    const list = this.signupsSig();
    for (let i = 0; i < list.length; i++) if (list[i]?.roomName === room) return list[i];
    return null;
  });
}
