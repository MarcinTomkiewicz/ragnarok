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
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfoModalComponent } from '../../../../common/info-modal/info-modal.component';
import { scrollToElementWithOffset } from '../../../../core/utils/scroll-to-top';
import { PlatformService } from '../../../../core/services/platform/platform.service';

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
  private readonly modalService = inject(NgbModal);
  private readonly platformService = inject(PlatformService);

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

  readonly maxStep = computed(() => 4);

  private scrollToStepperTop(): void {
    scrollToElementWithOffset('reservation-stepper', 60, this.platformService);
  }

  readonly canProceed = computed(() => {
    if (this.store.isReceptionMode() && this.step() === 0) {
      return this.store.isExternalInfoValid();
    }

    switch (this.step()) {
      case 1: {
        const room = this.store.selectedRoom();
        const isClubOnlyRoom = room === 'Asgard' || room === 'Alfheim';
        const hasClubConfirmed = this.store.confirmedTeam();
        return (
          !!room &&
          !!this.store.selectedDate() &&
          (!isClubOnlyRoom || hasClubConfirmed)
        );
      }
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
      this.scrollToStepperTop();
    } else {
      this.confirmReservation();
    }
  }

  goBack() {
    const current = this.step();
    const needsGm = this.store.needsGm();

    if (current === 4 && !needsGm) {
      this.step.set(2);
      this.scrollToStepperTop();
      return;
    }

    const prev = current - 1;
    if (prev >= 0) {
      this.step.set(prev);
      this.scrollToStepperTop();
    }
  }

  goBackDisabled() {
    return this.step() === 1 && !this.store.isReceptionMode();
  }

  private finalizeReservation() {
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

  confirmReservation() {
    const isReception = this.store.isReceptionMode();
    const date = this.store.selectedDate()!;
    const startHour = parseInt(this.store.selectedStartTime()!, 10);
    const duration = this.store.selectedDuration()!;

    if (!isReception) {
      this.reservationService
        .checkIfUserHasConflictingReservation(date, startHour, duration)
        .subscribe((hasConflict) => {
          if (hasConflict) {
            this.showUserAlreadyHasReservationModal();
            return;
          } else {
            this.finalizeReservation();
          }
        });
    } else {
      this.finalizeReservation();
    }
  }

  private showUserAlreadyHasReservationModal(): void {
    const modalRef = this.modalService.open(InfoModalComponent, {
      backdrop: 'static',
      centered: false,
    });
    modalRef.componentInstance.header = 'Rezerwacja istnieje!';
    modalRef.componentInstance.message =
      'Masz już aktywną rezerwację, która pokrywa się godzinowo z tą. Aby zarezerwować nowy termin, najpierw anuluj poprzednią rezerwację.';
    modalRef.componentInstance.showCancel = false;
  }
}
