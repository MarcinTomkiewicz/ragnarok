import { CommonModule } from '@angular/common';
import {
  Component,
  TemplateRef,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { format, isValid, parseISO } from 'date-fns';

import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { EventService } from '../../../core/services/event/event.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';

import { EventFull } from '../../../core/interfaces/i-events';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { HostSignupScope } from '../../../core/enums/events';
import { GmStyleTag } from '../../../core/enums/gm-styles';
import { CoworkerRoles } from '../../../core/enums/roles';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

import { SystemsPickerComponent } from '../create-party/systems-picker/systems-picker.component';
import { StyleTagsComponent } from '../create-party/style-tags/style-tags.component';

import { of, Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FilterOperator } from '../../../core/enums/filterOperator';
import { TriggerPickerComponent } from '../../common/trigger-picker/trigger-picker.component';
import { IContentTrigger } from '../../../core/interfaces/i-content-trigger';

@Component({
  selector: 'app-host-signup-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbDropdownModule,
    SystemsPickerComponent,
    StyleTagsComponent,
    TriggerPickerComponent
  ],
  templateUrl: './host-signup-form.component.html',
  styleUrls: ['./host-signup-form.component.scss'],
})
export class HostSignupFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backend = inject(BackendService);
  private readonly events = inject(EventService);
  private readonly images = inject(ImageStorageService);
  private readonly auth = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // stan
  readonly evSig = signal<EventFull | null>(null);
  readonly dateSig = signal<string | null>(null);
  readonly formattedDateSig = signal<string>('—');
  readonly loadingSig = signal<boolean>(true);
  readonly loadErrorSig = signal<string | null>(null);

  // systems
  readonly systemsSig = signal<IRPGSystem[]>([]);
  readonly systemsLoadingSig = signal<boolean>(false);

  // zajęte salki
  readonly takenRoomsSig = signal<Set<string>>(new Set());
  readonly takenLoadingSig = signal<boolean>(false);

  // obrazek
  readonly hostImageFileSig = signal<File | null>(null);
  readonly hostImagePreviewUrlSig = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    roomName: ['' as string],
    title: ['', [Validators.required]],
    systemId: ['' as string],
    description: [''],
    triggers: [[] as string[]],
    playstyleTags: [[] as GmStyleTag[]],
  });

  // toasty (jak w CreateParty)
  readonly hostSuccessToast =
    viewChild<TemplateRef<unknown>>('hostSuccessToast');
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
      this.formattedDateSig.set(
        isValid(d) ? format(d, 'dd.MM.yyyy') : dateParam
      );
    }

    const resolved = this.route.snapshot.data['event'] as
      | EventFull
      | null
      | undefined;
    if (resolved) {
      this.finishLoad(resolved);
    } else {
      const slug = this.route.snapshot.paramMap.get('slug');
      if (!slug) {
        this.loadingSig.set(false);
        this.loadErrorSig.set('Brak parametru slug w adresie.');
      } else {
        this.events
          .getBySlug(slug)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (ev) => {
              if (!ev) {
                this.loadErrorSig.set('Nie znaleziono wydarzenia.');
                this.loadingSig.set(false);
                return;
              }
              this.finishLoad(ev);
            },
            error: (err) => {
              console.error('Błąd pobierania wydarzenia', err);
              this.loadErrorSig.set('Błąd podczas pobierania wydarzenia.');
              this.loadingSig.set(false);
            },
          });
      }
    }

    this.fetchSystems();
    this.fetchTriggers();
  }

  private finishLoad(ev: EventFull) {
    this.evSig.set(ev);
    this.loadingSig.set(false);

    const roomCtrl = this.form.controls.roomName;

    if (ev.rooms?.length) {
      roomCtrl.addValidators([Validators.required]);

      if (roomCtrl.value) roomCtrl.setValue('');

      this.loadTakenRooms$()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((set) => this.takenRoomsSig.set(set));
    } else {
      roomCtrl.clearValidators();
      this.takenRoomsSig.set(new Set());
    }

    roomCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private loadTakenRooms$(): Observable<Set<string>> {
    const ev = this.evSig();
    const date = this.dateSig();

    if (!ev || !date || !ev.rooms?.length) {
      return of(new Set<string>());
    }
    this.takenLoadingSig.set(true);

    return this.backend
      .getAll<any>(
        'event_occurrence_hosts',
        undefined,
        'asc',
        {
          filters: {
            event_id: { operator: FilterOperator.EQ, value: ev.id },
            occurrence_date: { operator: FilterOperator.EQ, value: date },
          } as any,
        },
        undefined,
        undefined,
        false
      )
      .pipe(
        map(
          (rows) =>
            new Set<string>(
              (rows ?? [])
                .map((r: any) => r.roomName ?? r.room_name)
                .filter(Boolean)
            )
        ),
        finalize(() => this.takenLoadingSig.set(false))
      );
  }

  private fetchSystems() {
    this.systemsLoadingSig.set(true);
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
        finalize(() => this.systemsLoadingSig.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => this.systemsSig.set(rows ?? []),
        error: (err) => {
          console.error('Błąd pobierania systemów', err);
          this.systemsSig.set([]);
        },
      });
  }

  selectedRoomLabel(): string {
    const ev = this.evSig();
    const v = this.form.value.roomName;
    if (!ev?.rooms?.length) return 'Brak salek';
    if (!v) {
      const allTaken = ev.rooms.every((r) => this.takenRoomsSig().has(r));
      return allTaken ? 'Brak wolnych salek' : 'Wybierz salkę';
    }
    return v;
  }

  isRoomTaken(r: string): boolean {
    return this.takenRoomsSig().has(r);
  }

  allRoomsTaken(): boolean {
    const ev = this.evSig();
    if (!ev?.rooms?.length) return false;
    return ev.rooms.every((r) => this.takenRoomsSig().has(r));
  }

  pickRoom(r: string) {
    if (this.isRoomTaken(r)) return;
    this.form.controls.roomName.setValue(r);
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

  readonly triggersSig = signal<IContentTrigger[]>([]);
readonly triggersLoadingSig = signal(false);

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
      next: (rows) => this.triggersSig.set(rows ?? []),
      error: () => this.triggersSig.set([]),
    });
}

  onTriggersInput(e: Event) {
    const raw = (e.target as HTMLInputElement | null)?.value ?? '';
    const arr = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.form.controls.triggers.setValue(arr);
  }

  // obrazek
  onImageChange(ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.hostImageFileSig.set(file);
    const prev = this.hostImagePreviewUrlSig();
    if (prev) URL.revokeObjectURL(prev);
    this.hostImagePreviewUrlSig.set(file ? URL.createObjectURL(file) : null);
  }

  clearImage() {
    this.hostImageFileSig.set(null);
    const prev = this.hostImagePreviewUrlSig();
    if (prev) URL.revokeObjectURL(prev);
    this.hostImagePreviewUrlSig.set(null);
  }

  // nawigacja
  goBack() {
    this.router.navigate(['/auth/events']);
  }

  submit() {
    const ev = this.evSig();
    const date = this.dateSig();

    if (!ev || !date) return;
    if (!this.canSignup) return;

    // Jeśli event ma salki – wymagamy wyboru sali i wolnego miejsca
    if (ev.rooms?.length) {
      if (this.allRoomsTaken()) return;
      if (!this.form.value.roomName) return;
    }

    if (this.form.invalid) return;

    const user = this.auth.user()!;
    const v = this.form.getRawValue();

    const basePayload = {
      event_id: ev.id,
      occurrence_date: date,
      room_name: ev.rooms?.length ? v.roomName : null,
      host_user_id: user.id,
      role: 'GM',
      title: v.title,
      system_id: v.systemId || null,
      description: v.description || null,
      triggers: v.triggers ?? [],
      playstyle_tags: v.playstyleTags ?? [],
      image_path: null as string | null,
    };

    const file = this.hostImageFileSig();

    const createRow = (imagePath: string | null) => {
      const payload = { ...basePayload, image_path: imagePath };
      this.backend
        .create('event_occurrence_hosts', payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            const tpl = this.hostSuccessToast();
            if (tpl) {
              this.toastService.show({
                template: tpl,
                classname: 'bg-success text-white',
                header: 'Zgłoszenie zapisane!',
              });
            }
            this.router.navigate(['/auth/events']);
          },
          error: () => {
            const tpl = this.hostErrorToast();
            if (tpl) {
              this.toastService.show({
                template: tpl,
                classname: 'bg-danger text-white',
                header: 'Nie udało się zapisać zgłoszenia',
              });
            }
          },
        });
    };

    if (!file) {
      createRow(null);
      return;
    }

    const basePath = `events/${ev.id}/hosts/${date}`;
    this.images
      .transcodeAndUpload(file, basePath, {
        keepBaseName: true,
        uniqueStrategy: 'date',
        dateFormat: 'dd-MM-yyyy-HHmmss',
        prefer: 'avif',
        quality: 0.82,
        maxW: 1600,
        maxH: 1200,
        largerFallbackFactor: 1.15,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fullPath) => createRow(fullPath),
        error: () => {
          createRow(null);
        },
      });
  }
}
