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
import { combineLatest, map, switchMap } from 'rxjs';

import { IUser } from '../../core/interfaces/i-user';
import { IEventParticipant } from '../../core/interfaces/i-event-participant';
import { EventParticipantsService } from '../../core/services/event-participant/event-participant.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-session-signup-button',
  standalone: true,
  // hard stop: nic z tego komponentu nie bąbelkuje do karty
  host: {
    '(click)': '$event.stopPropagation()',
    '(mousedown)': '$event.stopPropagation()',
    '(pointerdown)': '$event.stopPropagation()',
  },
  template: `
    @if (isLoggedIn()) {
      <button
        type="button"
        class="btn btn-success btn-sm"
        [disabled]="isPending() || isFull()"
        (click)="onLoggedClick($event)"
        (mousedown)="$event.stopPropagation()"
        (pointerdown)="$event.stopPropagation()"
      >
        @if (isPending()) { Zapisywanie… }
        @else if (isFull()) { Pełne }
        @else { Dołącz }
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
      }
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
  hostId = input.required<string>();
  currentUser = input<IUser | null>(null);

  // NOWE: limit miejsc (0 lub null => brak limitu)
  capacity = input<number | null>(null);

  signed = output<IEventParticipant>();
  error = output<string>();

  readonly signupSuccessToast = viewChild<TemplateRef<unknown>>('signupSuccessToast');
  readonly signupErrorToast   = viewChild<TemplateRef<unknown>>('signupErrorToast');

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

  // ile osób już zapisanych na tę sesję
  private readonly occupiedCount = toSignal(
    combineLatest([
      toObservable(this.eventId),
      toObservable(this.dateIso),
      toObservable(this.hostId),
      toObservable(this.refreshTick),
    ]).pipe(
      switchMap(([eventId, dateIso, hostId]) =>
        this.participantsService
          .listForOccurrence(eventId, dateIso, { hostId })
          .pipe(map(rows => rows.length))
      )
    ),
    { initialValue: 0 }
  );

  // czy sesja jest pełna wg capacity
  isFull = computed(() => {
    const cap = this.capacity();
    if (cap == null || cap <= 0) return false; // brak limitu
    return this.occupiedCount() >= cap;
  });

  toggleForm(e: Event) {
    e.stopPropagation();
    if (this.isFull()) return; // nic nie rób, jeśli pełne
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
      this.toastService.show({ template: tpl, classname: 'bg-success text-white', header });
    }
  }
  private showErrorToast(header: string) {
    const tpl = this.signupErrorToast();
    if (tpl) {
      this.toastService.show({ template: tpl, classname: 'bg-danger text-white', header });
    }
  }

  // jawne stopPropagation + prosty log do weryfikacji
  onLoggedClick(e: Event) {
    e.stopPropagation();
    if (this.isFull() || this.isPending()) return;
    this.signupAsLoggedUser();
  }
  onGuestConfirmClick(e: Event) {
    e.stopPropagation();
    if (this.isFull() || this.isPending() || !this.canSubmitGuestForm()) return;
    this.signupAsGuest();
  }

  private signupAsLoggedUser() {
    this.isPending.set(true);
    this.participantsService
      .createForUser({
        eventId: this.eventId(),
        occurrenceDate: this.dateIso(),
        hostId: this.hostId(),
      })
      .subscribe({
        next: (participant) => {
          this.isPending.set(false);
          this.signed.emit(participant);
          this.refreshTick.set(this.refreshTick() + 1); // odśwież licznik
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
    this.isPending.set(true);
    this.participantsService
      .createForGuest({
        eventId: this.eventId(),
        occurrenceDate: this.dateIso(),
        hostId: this.hostId(),
        guestName: this.guestName().trim(),
        guestPhone: this.guestPhone().trim(),
      })
      .subscribe({
        next: (participant) => {
          this.isPending.set(false);
          this.guestName.set('');
          this.guestPhone.set('');
          this.isFormOpen.set(false);
          this.signed.emit(participant);
          this.refreshTick.set(this.refreshTick() + 1); // odśwież licznik
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
