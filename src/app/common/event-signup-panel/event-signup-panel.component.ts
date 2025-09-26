import { Component, input, output, signal, computed, inject, TemplateRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IUser } from '../../core/interfaces/i-user';
import { IEventParticipant } from '../../core/interfaces/i-event-participant';
import { EventParticipantsService } from '../../core/services/event-participant/event-participant.service';
import { ToastService } from '../../core/services/toast/toast.service';

@Component({
  selector: 'app-event-signup-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-signup-panel.component.html',
})
export class EventSignupPanelComponent {
  private readonly participantsService = inject(EventParticipantsService);
  private readonly toastService = inject(ToastService);

  eventId = input.required<string>();
  dateIso = input.required<string>();
  currentUser = input<IUser | null>(null);

  signed = output<IEventParticipant>();
  error = output<string>();

  guestName = signal('');
  guestPhone = signal('');
  note = signal('');
  isPending = signal(false);

  // toasty
  readonly signupSuccessToast = viewChild<TemplateRef<unknown>>('signupSuccessToast');
  readonly signupErrorToast = viewChild<TemplateRef<unknown>>('signupErrorToast');

  isLoggedIn = computed(() => !!this.currentUser());

  canSubmit = computed(() => {
    if (this.isLoggedIn()) return true;
    const name = this.guestName().trim();
    const phone = this.guestPhone().trim();
    return name.length >= 3 && /^[0-9+\s-]{9,15}$/.test(phone);
  });

  onGuestNameInput(event: Event) {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.guestName.set(value);
  }
  onGuestPhoneInput(event: Event) {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.guestPhone.set(value);
  }
  onNoteInput(event: Event) {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.note.set(value);
  }

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

  onSignup() {
    if (!this.canSubmit() || this.isPending()) return;

    const base = {
      eventId: this.eventId(),
      occurrenceDate: this.dateIso(),
      note: this.note().trim() || null,
    };

    this.isPending.set(true);

    const request$ = this.isLoggedIn()
      ? this.participantsService.createForUser(base)
      : this.participantsService.createForGuest({
          ...base,
          guestName: this.guestName().trim(),
          guestPhone: this.guestPhone().trim(),
        });

    request$.subscribe({
      next: (participant) => {
        this.isPending.set(false);
        // UX: wyczyść pola gościa po sukcesie
        if (!this.isLoggedIn()) {
          this.guestName.set('');
          this.guestPhone.set('');
          this.note.set('');
        }
        this.signed.emit(participant);
        this.showSuccessToast('Zapisano na wydarzenie');
      },
      error: (err) => {
        this.isPending.set(false);
        const msg = err?.message ?? 'Nie udało się zapisać.';
        this.error.emit(msg);
        this.showErrorToast('Nie udało się zapisać');
      },
    });
  }
}
