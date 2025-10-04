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

  /**
   * Zasada:
   * - bierzemy rezerwacje użytkownika (creator)
   * - dokładamy rezerwacje drużyn, w których jest Owner/Member
   * - deduplikujemy po id
   * - odrzucamy rezerwacje, w których user jest MG (reservation.gmId == me.id lub party.gmId == me.id),
   *   ALE robimy wyjątek: jeśli user JEST twórcą tej rezerwacji (reservation.userId == me.id), to ją zostawiamy
   */
  private loadReservations(): void {
    const me = this.auth.user();
    if (!me) return;

    const userId = me.id;

    const parties$ = forkJoin({
      owned: this.partyService.getPartiesOwnedBy(userId),
      member: this.partyService.getPartiesWhereMember(userId),
    }).pipe(
      map(({ owned, member }) => {
        const byId = new Map<string, IParty>();
        [...owned, ...member].forEach((p) => byId.set(p.id, p));
        return Array.from(byId.values());
      })
    );

    parties$
      .pipe(
        switchMap((parties) => {
          const partiesById = new Map(parties.map((p) => [p.id, p]));
          const teamIds = parties.map((p) => p.id);

          const teamRes$ = teamIds.length
            ? this.reservationService.getReservationsForTeams(teamIds)
            : of<IReservation[]>([]);

          return forkJoin({
            team: teamRes$,
            user: this.reservationService.getMyReservations(),
          }).pipe(
            map(({ team, user }) => {
              // deduplikacja
              const uniq = new Map<string, IReservation>();
              [...team, ...user].forEach((r) => uniq.set(r.id, r));
              let out = Array.from(uniq.values());

              // filtr MG z wyjątkiem twórcy rezerwacji
              out = out.filter((r) => {
                const isCreator = r.userId === userId;
                const isGmSelected = r.gmId === userId;
                const isPartyGm =
                  r.teamId ? partiesById.get(r.teamId)?.gmId === userId : false;

                // jeżeli jestem MG (wybrany lub GM drużyny), ale to MOJA rezerwacja – zostaw
                if ((isGmSelected || isPartyGm) && isCreator) return true;

                // jeżeli jestem MG i nie jestem twórcą – ukryj
                if (isGmSelected || isPartyGm) return false;

                // w pozostałych przypadkach – pokaż
                return true;
              });

              return out;
            })
          );
        }),
        catchError(() => of([] as IReservation[]))
      )
      .subscribe((result) => {
        this.reservationsSignal.set(result ?? []);
      });
  }

  onManage(reservation: IReservation): void {
    this.openCancelModal(reservation.id);
  }
}
