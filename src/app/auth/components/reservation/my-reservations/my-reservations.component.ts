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
import { from, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

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
import { IParty } from '../../../../core/interfaces/parties/i-party';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, ReservationListComponent],
  templateUrl: './my-reservations.component.html',
})
export class MyReservationsComponent {
  private readonly reservationService = inject(ReservationService);
  private readonly partyService = inject(PartyService);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(NgbModal);

  readonly cancelSuccessToast =
    viewChild<TemplateRef<unknown>>('cancelSuccessToast');
  readonly cancelAbortToast =
    viewChild<TemplateRef<unknown>>('cancelAbortToast');
  readonly cancelErrorToast =
    viewChild<TemplateRef<unknown>>('cancelErrorToast');

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
      .subscribe(() => this.loadReservations());
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
    const me = this.auth.user();
    if (!me) return;

    const userId = me.id;

    const parties$ = forkJoin({
      owned: this.partyService.getPartiesOwnedBy(userId),
      member: this.partyService.getPartiesWhereMember(userId),
    }).pipe(
      map(({ owned, member }) => {
        const map = new Map<string, IParty>();
        [...owned, ...member].forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
      })
    );

    parties$
      .pipe(
        switchMap((parties) => {
          const teamIds = parties.map((p) => p.id);
          const teamRes$ = teamIds.length
            ? this.reservationService.getReservationsForTeams(teamIds)
            : of<IReservation[]>([]);
          return forkJoin({
            team: teamRes$,
            user: this.reservationService.getMyReservations(),
          }).pipe(map(({ team, user }) => [...team, ...user]));
        })
      )
      .subscribe((allReservations) => {
        this.reservationsSignal.set(allReservations ?? []);
      });
  }

  onManage(reservation: IReservation): void {
    this.openCancelModal(reservation.id);
  }
}
