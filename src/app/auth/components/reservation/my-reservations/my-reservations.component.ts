import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  signal,
  viewChild,
  WritableSignal,
  TemplateRef,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { from } from 'rxjs';
import { tap, switchMap, catchError } from 'rxjs/operators';
import { isAfter, isToday } from 'date-fns';

import { InfoModalComponent } from '../../../../common/info-modal/info-modal.component';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';
import { ToastService } from '../../../../core/services/toast/toast.service';

import {
  ReservationStatus,
  ReservationStatusDisplay,
  IReservation,
} from '../../../../core/interfaces/i-reservation';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './my-reservations.component.html',
})
export class MyReservationsComponent {
  // === DI ===
  private readonly reservationService = inject(ReservationService);
  private readonly modal = inject(NgbModal);
  private readonly toastService = inject(ToastService);

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
    this.reservationService.getMyReservations().subscribe((res) => {
      this.reservationsSignal.set(res ?? []);
    });
  }
}
