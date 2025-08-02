import {
  Component,
  inject,
  TemplateRef,
  viewChild,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { RoomSelectionComponent } from '../room-selection/room-selection.component';
import { TimeSelectionComponent } from '../time-selection/time-selection.component';
import { GmSelectionComponent } from '../gm-selection/gm-selection.component';
import { ReservationSummaryComponent } from '../reservation-summary/reservation-summary.component';

import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { ReservationStatus } from '../../../../core/interfaces/i-reservation';
import { UserInfoFormComponent } from '../user-info-form/user-info-form.component';

@Component({
  selector: 'app-reservation-stepper',
  standalone: true,
  imports: [
    CommonModule,
    UserInfoFormComponent,
    RoomSelectionComponent,
    TimeSelectionComponent,
    GmSelectionComponent,
    ReservationSummaryComponent,
  ],
  templateUrl: './reservation-stepper.component.html',
  styleUrls: ['./reservation-stepper.component.scss'],
})
export class ReservationStepperComponent {
  readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly step = this.store.step;

  constructor() {
    const initialStep = this.route.snapshot.data['initialStep'];
    const receptionMode = this.route.snapshot.data['receptionMode'];

    if (typeof initialStep === 'number') {
      this.store.step.set(initialStep);
    }

    if (receptionMode === true) {
      this.store.isReceptionMode.set(true);
    }
  }

  readonly reservationSuccessToast = viewChild<TemplateRef<unknown>>(
    'reservationSuccessToast'
  );
  readonly reservationErrorToast = viewChild<TemplateRef<unknown>>(
    'reservationErrorToast'
  );

  readonly maxStep = computed(() => (this.store.needsGm() ? 4 : 3));

  readonly canProceed = computed(() => {
    if (this.store.isReceptionMode() && this.step() === 0) {
      return this.store.isExternalInfoValid();
    }
    switch (this.step()) {
      case 1:
        return !!this.store.selectedRoom() && !!this.store.selectedDate();
      case 2:
        return (
          !!this.store.selectedStartTime() && !!this.store.selectedDuration()
        );
      case 3:
        return !!this.store.selectedSystemId() && !!this.store.selectedGm();
      case 4:
        return true;
      default:
        return false;
    }
  });

  goForward() {
    if (!this.canProceed()) return;

    const current = this.step();
    const needsGm = this.store.needsGm();

    if (current === 2 && !needsGm) {
      this.step.set(4);
      return;
    }

    if (current < this.maxStep()) {
      this.step.set(current + 1);
    } else {
      this.confirmReservation();
    }
  }

  goBack() {
    const current = this.step();
    const needsGm = this.store.needsGm();

    if (current === 4 && !needsGm) {
      this.step.set(2);
      return;
    }

    const prev = current - 1;    
    if (prev >= 0) this.step.set(prev);
  }

  goBackDisabled() {
    return this.step() === 1 && !this.store.isReceptionMode()
  }

  confirmReservation() {
    const payload = {
      userId: this.auth.user()?.id,
      roomName: this.store.selectedRoom(),
      date: this.store.selectedDate()!,
      startTime: this.store.selectedStartTime()!,
      durationHours: this.store.selectedDuration()!,
      needsGm: this.store.needsGm(),
      gmId: this.store.selectedGm(),
      systemId: this.store.selectedSystemId(),
      confirmedTeam: this.store.confirmedTeam(),
      external_name: this.store.isReceptionMode()
        ? this.store.externalName()
        : null,
      external_phone: this.store.isReceptionMode()
        ? this.store.externalPhone()
        : null,
      external_is_member: this.store.isReceptionMode()
        ? this.store.externalIsClubMember()
        : null,
      status: ReservationStatus.Confirmed,
    };

    this.reservationService.createReservation(payload).subscribe({
      next: () => {
        const template = this.reservationSuccessToast();
        if (template) {
          this.toastService.show({
            template,
            classname: 'bg-success text-white',
            header: 'Utworzono rezerwację!',
          });
        }
        this.router.navigate(['/auth/my-reservations']);
      },
      error: () => {
        const template = this.reservationErrorToast();
        if (template) {
          this.toastService.show({
            template,
            classname: 'bg-danger text-white',
            header: 'Nie udało się utworzyć rezerwacji',
          });
        }
      },
    });
  }
}
