import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { IUser } from '../../core/interfaces/i-user';
import { IEventParticipant } from '../../core/interfaces/i-event-participant';
import { EventParticipantsService } from '../../core/services/event-participant/event-participant.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { AuthService } from '../../core/services/auth/auth.service';

type Scope = { hostId?: string; roomName?: string };

@Component({
  selector: 'app-session-signup-button',
  standalone: true,
  host: {
    '(click)': '$event.stopPropagation()',
    '(mousedown)': '$event.stopPropagation()',
    '(pointerdown)': '$event.stopPropagation()',
  },
  template: `
    @if (isValidTarget()) { @if (isLoggedIn()) {
    <button
      type="button"
      class="btn btn-success btn-sm"
      [disabled]="isPending() || isFull()"
      (click)="onLoggedClick($event)"
      (mousedown)="$event.stopPropagation()"
      (pointerdown)="$event.stopPropagation()"
    >
      @if (isPending()) { Zapisywanie… } @else if (isFull()) { Pełne } @else {
      Dołącz }
    </button>
    } @else {
    <button
      type="button"
      class="btn btn-outline btn-sm"
      [disabled]="isFull()"
      (click)="toggleForm($event)"
      (mousedown)="$event.stopPropagation()"
      (pointerdown)="$event.stopPropagation()"
    >
      @if (isFull()) { Pełne } @else { Dołącz (gość) }
    </button>

    @if (isFormOpen() && !isFull()) {
    <form class="form-group mt-2">
      <input
        class="form-control"
        placeholder="Imię/pseudonim"
        [value]="guestName()"
        (input)="onGuestNameInput($event)"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()"
        (pointerdown)="$event.stopPropagation()"
        [disabled]="isPending()"
      />
      <input
        class="form-control form-control-input mt-1"
        placeholder="Telefon"
        [value]="guestPhone()"
        (input)="onGuestPhoneInput($event)"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.stopPropagation()"
        (pointerdown)="$event.stopPropagation()"
        [disabled]="isPending()"
      />
      <button
        type="button"
        class="btn btn-primary btn-sm mt-1"
        [disabled]="!canSubmitGuestForm() || isPending()"
        (click)="onGuestConfirmClick($event)"
        (mousedown)="$event.stopPropagation()"
        (pointerdown)="$event.stopPropagation()"
      >
        @if (isPending()) { Zapisywanie… } @else { Potwierdź }
      </button>
    </form>
    } } } @else {
    <!-- jeśli nie podano hostId ani roomName — nic nie renderujemy -->
    <span class="sr-only">Brak celu zapisu</span>
    }

    <ng-template #signupSuccessToast>
      <strong>Sukces!</strong> Zapisano na sesję.
    </ng-template>

    <ng-template #signupErrorToast>
      <strong>Błąd!</strong> Nie udało się zapisać na sesję.
    </ng-template>
  `,
})
export class SessionSignupButtonComponent {
  private readonly participantsService = inject(EventParticipantsService);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);

  // wymagane
  eventId = input.required<string>();
  dateIso = input.required<string>();
  currentUser = input<IUser | null>(null);

  /**
   * Cel zapisu:
   * - hostId (dla kart/slotów),
   * - roomName (dla FullSpan).
   * Min. jeden z nich musi być ustawiony.
   */
  hostId = input<string | null>(null);
  roomName = input<string | null>(null);

  // limit miejsc (0 => bez limitu, null => nie pokazuj licznika / brak limitu)
  capacity = input<number | null>(null);

  signed = output<IEventParticipant>();
  error = output<string>();

  readonly signupSuccessToast =
    viewChild<TemplateRef<unknown>>('signupSuccessToast');
  readonly signupErrorToast =
    viewChild<TemplateRef<unknown>>('signupErrorToast');

  // auth.user to signal — wywołujemy!
  private readonly effectiveUser = computed<IUser | null>(() => {
    const fromInput = this.currentUser();
    if (fromInput) return fromInput;
    return this.auth.user();
  });
  isLoggedIn = computed(() => !!this.effectiveUser());

  // local UI state
  isFormOpen = signal(false);
  guestName = signal('');
  guestPhone = signal('');
  isPending = signal(false);

  // odświeżenie lokalnego licznika po udanym zapisie
  private readonly refreshTick = signal(0);

  // walidacja celu zapisu: hostId XOR roomName
  isValidTarget = computed(() => {
    const h = (this.hostId() ?? '').trim();
    const r = (this.roomName() ?? '').trim();
    return (h && !r) || (!h && r);
  });

  private targetScope = computed<Scope | null>(() => {
    if (!this.isValidTarget()) return null;
    const h = (this.hostId() ?? '').trim();
    const r = (this.roomName() ?? '').trim();
    return h ? { hostId: h } : { roomName: r };
  });

  private readonly occupiedCount = toSignal(
    combineLatest([
      toObservable(this.eventId),
      toObservable(this.dateIso),
      toObservable(this.targetScope),
      toObservable(this.refreshTick),
    ]).pipe(
      switchMap(([eventId, dateIso, scope]) => {
        if (!scope) return of(0);
        return this.participantsService
          .listForOccurrence(eventId, dateIso, scope)
          .pipe(map((rows) => rows.length));
      })
    ),
    {
      initialValue: 0,
      requireSync: false,
    } as const
  );

  // czy pełne wg capacity
  isFull = computed(() => {
    const cap = this.capacity();
    if (cap == null || cap <= 0) return false; // brak limitu
    return this.occupiedCount() >= cap;
  });

  toggleForm(e: Event) {
    e.stopPropagation();
    if (!this.isValidTarget() || this.isFull()) return;
    this.isFormOpen.set(!this.isFormOpen());
  }

  onGuestNameInput(event: Event) {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.guestName.set(value);
  }
  onGuestPhoneInput(event: Event) {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.guestPhone.set(value);
  }

  canSubmitGuestForm = computed(
    () =>
      this.guestName().trim().length >= 3 &&
      /^[0-9+\s-]{9,15}$/.test(this.guestPhone().trim())
  );

  private showSuccessToast(header: string) {
    const tpl = this.signupSuccessToast();
    if (tpl) {
      this.toastService.show({
        template: tpl,
        classname: 'bg-success text-white',
        header,
      });
    }
  }
  private showErrorToast(header: string) {
    const tpl = this.signupErrorToast();
    if (tpl) {
      this.toastService.show({
        template: tpl,
        classname: 'bg-danger text-white',
        header,
      });
    }
  }

  onLoggedClick(e: Event) {
    e.stopPropagation();
    if (!this.isValidTarget() || this.isFull() || this.isPending()) return;
    this.signupAsLoggedUser();
  }
  onGuestConfirmClick(e: Event) {
    e.stopPropagation();
    if (
      !this.isValidTarget() ||
      this.isFull() ||
      this.isPending() ||
      !this.canSubmitGuestForm()
    )
      return;
    this.signupAsGuest();
  }

  private signupAsLoggedUser() {
    const scope = this.targetScope();
    if (!scope) return;
    this.isPending.set(true);

    this.participantsService
      .createForUser({
        eventId: this.eventId(),
        occurrenceDate: this.dateIso(),
        ...scope, // hostId LUB roomName
      } as any)
      .subscribe({
        next: (participant) => {
          this.isPending.set(false);
          this.signed.emit(participant);
          this.refreshTick.set(this.refreshTick() + 1);
          this.showSuccessToast('Zapisano na sesję');
        },
        error: (err) => {
          this.isPending.set(false);
          const msg = err?.message ?? 'Błąd zapisu.';
          this.error.emit(msg);
          this.showErrorToast('Nie udało się zapisać');
        },
      });
  }

  private signupAsGuest() {
    const scope = this.targetScope();
    if (!scope) return;
    this.isPending.set(true);

    this.participantsService
      .createForGuest({
        eventId: this.eventId(),
        occurrenceDate: this.dateIso(),
        guestName: this.guestName().trim(),
        guestPhone: this.guestPhone().trim(),
        ...scope, // hostId LUB roomName
      } as any)
      .subscribe({
        next: (participant) => {
          this.isPending.set(false);
          this.guestName.set('');
          this.guestPhone.set('');
          this.isFormOpen.set(false);
          this.signed.emit(participant);
          this.refreshTick.set(this.refreshTick() + 1);
          this.showSuccessToast('Zapisano na sesję');
        },
        error: (err) => {
          this.isPending.set(false);
          const msg = err?.message ?? 'Błąd zapisu.';
          this.error.emit(msg);
          this.showErrorToast('Nie udało się zapisać');
        },
      });
  }
}
