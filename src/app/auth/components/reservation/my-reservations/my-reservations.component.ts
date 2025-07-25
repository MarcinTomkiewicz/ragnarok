import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { InfoModalComponent } from '../../../../common/info-modal/info-modal.component';
import {
  ReservationStatus,
  ReservationStatusDisplay,
} from '../../../../core/interfaces/i-reservation';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, AsyncPipe, NgbTooltip],
  templateUrl: './my-reservations.component.html',
})
export class MyReservationsComponent {
  private readonly reservationService = inject(ReservationService);
  private modal = inject(NgbModal);

  reservations$ = this.reservationService.getMyReservations();

  statusDisplay = ReservationStatusDisplay;
  statusEnum = ReservationStatus;

  openCancelModal(reservationId: string) {
    const modalRef = this.modal.open(InfoModalComponent, {
      size: 'md',
      backdrop: 'static',
      keyboard: false,
    });
    modalRef.componentInstance.header = 'Potwierdzenie';
    modalRef.componentInstance.message =
      'Czy na pewno chcesz odwołać tę rezerwację?';
    modalRef.componentInstance.showCancel = true;

    modalRef.result
      .then((result) => {
        if (result) {
          this.reservationService
            .cancelReservation(reservationId)
            .subscribe(() => {
              this.reservations$ = this.reservationService.getMyReservations();
            });
        }
      })
      .catch(() => {
        // Modal dismissed – użytkownik kliknął Anuluj lub zamknął modal
      });
  }
}
