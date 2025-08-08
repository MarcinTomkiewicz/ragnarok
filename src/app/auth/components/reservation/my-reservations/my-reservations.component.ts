import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { isAfter, isToday } from 'date-fns';
import { from } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { InfoModalComponent } from '../../../../common/info-modal/info-modal.component';
import { ToastService } from '../../../../core/services/toast/toast.service';

import {
  IReservation,
  ReservationStatus,
  ReservationStatusDisplay,
} from '../../../../core/interfaces/i-reservation';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ReservationListComponent } from '../../../common/reservation-list/reservation-list.component';
import { PartyService } from '../../../core/services/party/party.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, ReservationListComponent],
  templateUrl: './my-reservations.component.html',
})
export class MyReservationsComponent {
  // === DI ===
  private readonly reservationService = inject(ReservationService);
  private readonly partyService = inject(PartyService);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(NgbModal);

  // === Toast templates ===
  readonly cancelSuccessToast =
    viewChild<TemplateRef<unknown>>('cancelSuccessToast');
  readonly cancelAbortToast =
    viewChild<TemplateRef<unknown>>('cancelAbortToast');
  readonly cancelErrorToast =
    viewChild<TemplateRef<unknown>>('cancelErrorToast');

  // === Signals ===
  private readonly reservationsSignal: WritableSignal<IReservation[]> = signal(
    []
  );
  readonly filteredReservations = computed(() => {
    const reservations = this.reservationsSignal();
    const now = new Date();
    return reservations.filter((r) => {
      const reservationDate = new Date(r.date);
      return isToday(reservationDate) || isAfter(reservationDate, now);
    });
  });

  readonly statusDisplay = ReservationStatusDisplay;
  readonly statusEnum = ReservationStatus;

  constructor() {
    this.loadReservations();
  }

  openCancelModal(reservationId: string): void {
    const modalRef = this.modal.open(InfoModalComponent, {
      size: 'md',
      backdrop: 'static',
      keyboard: false,
    });

    modalRef.componentInstance.header = 'Potwierdzenie';
    modalRef.componentInstance.message =
      'Czy na pewno chcesz odwołać tę rezerwację?';
    modalRef.componentInstance.showCancel = true;

    from(modalRef.result)
      .pipe(
        switchMap((confirmed) => {
          if (!confirmed) {
            this.showCancelAbortedToast();
            return [];
          }

          return this.reservationService.cancelReservation(reservationId).pipe(
            tap(() => this.showCancelSuccessToast()),
            catchError(() => {
              this.showCancelErrorToast();
              return [];
            })
          );
        }),
        catchError(() => {
          this.showCancelAbortedToast();
          return [];
        })
      )
      .subscribe(() => {
        this.loadReservations();
      });
  }

  private showCancelSuccessToast(): void {
    const template = this.cancelSuccessToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-success text-white',
        header: 'Rezerwacja anulowana',
      });
    }
  }

  private showCancelAbortedToast(): void {
    const template = this.cancelAbortToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-warning text-black',
        header: 'Anulowanie przerwane',
      });
    }
  }

  private showCancelErrorToast(): void {
    const template = this.cancelErrorToast();
    if (template) {
      this.toastService.show({
        template,
        classname: 'bg-danger text-white',
        header: 'Błąd anulowania rezerwacji',
      });
    }
  }

  private loadReservations(): void {
    const userId = this.auth.user()?.id;
    if (userId) {
      this.partyService.getUserParties(userId).subscribe((parties) => {
        const teamIds = parties.map((party) => party.id);

        this.reservationService
          .getReservationsForTeams(teamIds)
          .subscribe((res) => {
            this.reservationsSignal.set(res ?? []);
          });
      });
    }
  }

  onManage(reservation: IReservation): void {
    this.openCancelModal(reservation.id);
  }
}
