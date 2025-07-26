import {
  Component,
  computed,
  inject,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { format } from 'date-fns';
import { ReservationStatus } from '../../../../core/interfaces/i-reservation';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-reservation-summary',
  standalone: true,
  imports: [],
  templateUrl: './reservation-summary.component.html',
  styleUrl: './reservation-summary.component.scss',
})
export class ReservationSummaryComponent {
  readonly store = inject(ReservationStoreService);
  readonly auth = inject(AuthService);
  readonly reservationService = inject(ReservationService);
  private readonly toastService = inject(ToastService);
  readonly successToast = viewChild<TemplateRef<unknown>>('reservationSuccessToast');

  readonly summary = computed(() => ({
    room: this.store.selectedRoom(),
    date: this.store.selectedDate(),
    startTime: this.store.selectedStartTime(),
    duration: this.store.selectedDuration(),
    needsGm: this.store.needsGm(),
    gmId: this.store.selectedGm(),
    systemId: this.store.selectedSystemId(),
  }));

  readonly formattedDate = computed(() => {
    const raw = this.store.selectedDate();
    return raw ? format(new Date(raw), 'dd.MM.yyyy') : '';
  });

  confirm() {
    const payload = {
      userId: this.auth.user()?.id, // jeśli nie masz w store
      roomName: this.store.selectedRoom(),
      date: this.store.selectedDate()!,
      startTime: this.store.selectedStartTime()!,
      durationHours: this.store.selectedDuration()!,
      needsGm: this.store.needsGm(),
      gmId: this.store.selectedGm(),
      systemId: this.store.selectedSystemId(),
      confirmedTeam: this.store.confirmedTeam(),
      status: ReservationStatus.Confirmed,
    };

    this.reservationService.createReservation(payload).subscribe({
      next: (res) => {
          const template = this.successToast();
          if (template) {
            this.toastService.show({
              template,
              classname: 'bg-success text-white',
              header: 'Utworzono rezerwację!',
            });
          }
      },
      error: (err) => {
        console.error('❌ Błąd przy rezerwacji:', err);
      },
    });
  }

  handleBack() {
    this.store.step.set(this.store.needsGm() ? 3 : 2);
  }
}
