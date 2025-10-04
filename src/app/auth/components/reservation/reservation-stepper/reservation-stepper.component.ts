import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { InfoModalComponent } from '../../../../common/info-modal/info-modal.component';
import { ReservationStatus } from '../../../../core/interfaces/i-reservation';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { PlatformService } from '../../../../core/services/platform/platform.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { scrollToElementWithOffset } from '../../../../core/utils/scroll-to-top';

import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { PartyService } from '../../../core/services/party/party.service';

import { UserInfoFormComponent } from '../user-info-form/user-info-form.component';
import { RoomSelectionComponent } from '../room-selection/room-selection.component';
import { TimeSelectionComponent } from '../time-selection/time-selection.component';
import { GmSelectionComponent } from '../gm-selection/gm-selection.component';
import { GmExtraInfoComponent } from '../gm-extra-info/gm-extra-info.component';
import { ReservationSummaryComponent } from '../reservation-summary/reservation-summary.component';

@Component({
  selector: 'app-reservation-stepper',
  standalone: true,
  imports: [
    CommonModule,
    UserInfoFormComponent,
    RoomSelectionComponent,
    TimeSelectionComponent,
    GmSelectionComponent,
    GmExtraInfoComponent,
    ReservationSummaryComponent,
  ],
  templateUrl: './reservation-stepper.component.html',
  styleUrls: ['./reservation-stepper.component.scss'],
})
export class ReservationStepperComponent {
  readonly store = inject(ReservationStoreService);
  readonly platformService = inject(PlatformService);
  readonly toastService = inject(ToastService);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly partyService = inject(PartyService);
  private readonly reservationService = inject(ReservationService);
  private readonly modalService = inject(NgbModal);

  readonly step = this.store.step;

  readonly deferredInfo = signal(false);
  readonly isReception = computed(() => this.store.isReceptionMode());

  // Czy użytkownik chce podać dodatkowe informacje dla MG?
  readonly extraInfoEnabled = computed(() => this.store.wantsGmExtraInfo());

  // Indeks kroku „Dodatkowe informacje dla MG”
  private readonly EXTRA_INFO_STEP_INDEX = 4;

  // Jeżeli jest tryb recepcji i odroczone dane usera,
  // to ich indeks zależy od tego, czy mamy krok „extra info”.
  readonly userInfoDeferredStep = computed(() =>
    this.extraInfoEnabled() ? 5 : 4
  );

  // Summary przesuwa się o +1 gdy mamy extra-info
  // i o +1 gdy jest odroczone user-info (recepcja).
  readonly summaryStep = computed(() => {
    const base = 4; // bazowo bez extra-info i bez deferred user-info
    const addExtra = this.extraInfoEnabled() ? 1 : 0;
    const addDeferred = (this.isReception() && this.deferredInfo()) ? 1 : 0;
    return base + addExtra + addDeferred;
  });

  // Maksymalny krok używany w widoku (dla przycisku Dalej/Rezerwuj)
  readonly maxStep = computed(() => this.summaryStep());

  // helper – klik z kroku 0 (recepcja): „podaj dane na końcu”
  deferUserInfoAndGo() {
    if (!this.isReception()) return;
    this.deferredInfo.set(true);
    const current = this.step();
    if (current === 0) {
      this.step.set(1);
      this.scrollToStepperTop();
      this.store.saveToStorage();
    }
  }

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

  private scrollToStepperTop(): void {
    scrollToElementWithOffset('reservation-stepper', 60, this.platformService);
  }

  readonly canProceed = computed(() => {
    // Krok 0 (tylko recepcja bez odroczenia)
    if (this.store.isReceptionMode() && this.step() === 0 && !this.deferredInfo()) {
      return this.store.isExternalInfoValid();
    }

    switch (this.step()) {
      case 1: { // Room
        const room = this.store.selectedRoom();
        const isClubOnlyRoom = room === 'Asgard' || room === 'Alfheim';
        const hasClubConfirmed = this.store.confirmedParty();
        return !!room && !!this.store.selectedDate() && (!isClubOnlyRoom || hasClubConfirmed);
      }
      case 2: // Time
        return !!this.store.selectedStartTime() && !!this.store.selectedDuration();

      case 3: // GM selection
        return !!this.store.selectedSystemId() && !!this.store.selectedGm();

      case 4: {
        // Jeżeli to jest krok „extra info” – nie blokujemy przejścia
        if (this.extraInfoEnabled()) return true;

        // Jeżeli to jest odroczone user-info (bez extra-info)
        if (this.isReception() && this.deferredInfo() && this.userInfoDeferredStep() === 4) {
          return this.store.isExternalInfoValid();
        }
        return true;
      }

      case 5: {
        // Jeżeli mamy extra-info, to 5 może być odroczonym user-info
        if (this.isReception() && this.deferredInfo() && this.userInfoDeferredStep() === 5) {
          return this.store.isExternalInfoValid();
        }
        return true;
      }

      default:
        // Pozostałe kroki (np. summary) — przycisk ogranicza template
        return true;
    }
  });

  goForward() {
    if (!this.canProceed()) return;

    const current = this.step();
    const needsGm = this.store.needsGm();
    const summary = this.summaryStep();

    // Krok 2 -> zależne od potrzeb MG i drużyny
    if (current === 2) {
      const pid = this.store.selectedPartyId();

      if (!needsGm) {
        // Bez MG — prosto do user-info (jeśli odroczone) lub podsumowania
        this.step.set(
          this.isReception() && this.deferredInfo()
            ? this.userInfoDeferredStep()
            : summary
        );
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      if (pid) {
        this.partyService.getPartyById(pid).subscribe((team) => {
          const isJoin = !!team?.beginnersProgram && team?.programStage === 1;

          if (!isJoin) {
            this.step.set(3);
            this.scrollToStepperTop();
            this.store.saveToStorage();
            return;
          }

          const ensureThenGo = () => {
            this.step.set(
              this.isReception() && this.deferredInfo()
                ? this.userInfoDeferredStep()
                : summary
            );
            this.scrollToStepperTop();
            this.store.saveToStorage();
          };

          if (!this.store.selectedGm() && team?.gmId) {
            this.store.selectedGm.set(team.gmId);
          }

          if (!this.store.selectedSystemId()) {
            this.partyService.getPartySystems(pid).subscribe((sys) => {
              const first = sys[0]?.id ?? null;
              this.store.selectedSystemId.set(first);
              ensureThenGo();
            });
            return;
          }

          ensureThenGo();
        });
        return;
      }

      this.step.set(3);
      this.scrollToStepperTop();
      this.store.saveToStorage();
      return;
    }

    // Krok 3 -> albo EXTRA INFO, albo deferred user-info / summary
    if (current === 3) {
      if (this.extraInfoEnabled()) {
        this.step.set(this.EXTRA_INFO_STEP_INDEX);
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }
      this.step.set(
        this.isReception() && this.deferredInfo()
          ? this.userInfoDeferredStep()
          : summary
      );
      this.scrollToStepperTop();
      this.store.saveToStorage();
      return;
    }

    // EXTRA INFO -> dalej do deferred user-info (jeśli jest) lub summary
    if (current === this.EXTRA_INFO_STEP_INDEX) {
      this.step.set(
        this.isReception() && this.deferredInfo()
          ? this.userInfoDeferredStep()
          : summary
      );
      this.scrollToStepperTop();
      this.store.saveToStorage();
      return;
    }

    // Zwykłe przesuwanie do przodu aż do summary
    if (current < summary) {
      this.step.set(current + 1);
      this.scrollToStepperTop();
      this.store.saveToStorage();
    } else {
      // Summary -> finalizacja
      this.confirmReservation();
    }
  }

  goBack() {
    const current = this.step();
    const summary = this.summaryStep();

    // Z podsumowania cofamy się do:
    // - odroczonego user-info (jeśli jest)
    // - albo do EXTRA INFO (jeśli jest)
    // - albo do 3/2 wg oryginalnych zasad
    if (current === summary) {
      if (this.isReception() && this.deferredInfo()) {
        this.step.set(this.userInfoDeferredStep());
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      if (this.extraInfoEnabled()) {
        this.step.set(this.EXTRA_INFO_STEP_INDEX);
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      const needsGm = this.store.needsGm();
      if (!needsGm) {
        this.step.set(2);
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      const pid = this.store.selectedPartyId();
      if (!pid) {
        this.step.set(3);
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      this.partyService.getPartyById(pid).subscribe((team) => {
        const isJoin = !!team?.beginnersProgram && team?.programStage === 1;
        this.step.set(isJoin ? 2 : 3);
        this.scrollToStepperTop();
        this.store.saveToStorage();
      });
      return;
    }

    // Cofanie z deferred user-info (niezależnie czy to 4 czy 5)
    if (this.isReception() && this.deferredInfo() && current === this.userInfoDeferredStep()) {
      const needsGm = this.store.needsGm();
      if (!needsGm) {
        this.step.set(2);
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      const pid = this.store.selectedPartyId();
      if (!pid) {
        this.step.set(3);
        this.scrollToStepperTop();
        this.store.saveToStorage();
        return;
      }

      this.partyService.getPartyById(pid).subscribe((team) => {
        const isJoin = !!team?.beginnersProgram && team?.programStage === 1;
        this.step.set(isJoin ? 2 : 3);
        this.scrollToStepperTop();
        this.store.saveToStorage();
      });
      return;
    }

    // Z kroku 1 nienależy cofać się do 0 u zwykłego usera
    if (current === 1 && !this.store.isReceptionMode()) return;

    const prev = current - 1;
    if (prev >= 0) {
      this.step.set(prev);
      this.scrollToStepperTop();
      this.store.saveToStorage();
    }
  }

  goBackDisabled() {
    return this.step() === 1 && (!this.store.isReceptionMode() || this.deferredInfo());
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
    confirmedTeam: this.store.confirmedParty(),
    external_name: this.store.isReceptionMode() ? this.store.externalName() : null,
    external_phone: this.store.isReceptionMode() ? this.store.externalPhone() : null,
    external_is_member: this.store.isReceptionMode() ? this.store.externalIsClubMember() : null,
    status: ReservationStatus.Confirmed,
    teamId: this.store.selectedPartyId(),
  };

  const wantsExtra = this.store.wantsGmExtraInfo();
  const extra = wantsExtra ? this.store.gmExtraInfo?.() ?? null : null;

  const onSuccess = () => {
    const template = this.reservationSuccessToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-success text-white',
        header: 'Utworzono rezerwację!',
      });
    }

    if (this.platformService.isBrowser) {
      sessionStorage.removeItem('selectedRoom');
      sessionStorage.removeItem('selectedDate');
      sessionStorage.removeItem('selectedStartTime');
      sessionStorage.removeItem('selectedDuration');
      sessionStorage.removeItem('selectedGm');
      sessionStorage.removeItem('needsGm');
      sessionStorage.removeItem('selectedPartyId');
      sessionStorage.removeItem('externalName');
      sessionStorage.removeItem('externalPhone');
      sessionStorage.removeItem('externalIsClubMember');
      sessionStorage.removeItem('wantsGmExtraInfo');
      sessionStorage.removeItem('gmExtraInfo');
    }

    this.router.navigate(['/auth/my-reservations']);
  };

  const onError = () => {
    const template = this.reservationErrorToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-danger text-white',
        header: 'Nie udało się utworzyć rezerwacji',
      });
    }
  };

  this.reservationService
    .createReservationWithOptionalExtra(payload as any, extra)
    .subscribe({ next: onSuccess, error: onError });
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
