import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { format } from 'date-fns';
import { combineLatest, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';

import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IGmExtraInfo } from '../../../../core/interfaces/i-gm-extra-info';

import { GmDirectoryService } from '../../../core/services/gm/gm-directory/gm-directory.service';
import { PartyService } from '../../../core/services/party/party.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-reservation-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-summary.component.html',
  styleUrl: './reservation-summary.component.scss',
})
export class ReservationSummaryComponent {
  readonly store = inject(ReservationStoreService);
  private readonly gmDirectoryService = inject(GmDirectoryService);
  private readonly partyService = inject(PartyService);
  private readonly reservationService = inject(ReservationService);
  private readonly destroyRef = inject(DestroyRef);

  gmDisplayName = '';
  partyDisplayName = '';
  systemDisplayName = '';

  constructor() {
    // GM name
    toObservable(this.store.selectedGm)
      .pipe(
        startWith(this.store.selectedGm()),
        switchMap((gmId) => (gmId ? this.gmDirectoryService.getGmById(gmId) : of(null))),
        map((gm) => (gm ? this.gmDirectoryService.gmDisplayName(gm) : '')),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((name) => (this.gmDisplayName = name));

    // Party name
    toObservable(this.store.selectedPartyId)
      .pipe(
        startWith(this.store.selectedPartyId()),
        switchMap((pid) => (pid ? this.partyService.getPartyById(pid) : of(null))),
        map((party) => party?.name ?? ''),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((name) => (this.partyDisplayName = name));

    // System name
    const systems$ = this.reservationService.getAllSystems();
    combineLatest([
      systems$,
      toObservable(this.store.selectedSystemId).pipe(startWith(this.store.selectedSystemId())),
    ])
      .pipe(
        map(([systems, sid]) => {
          if (!sid) return '';
          const hit = (systems as IRPGSystem[]).find((s) => s.id === sid);
          return hit?.name ?? '';
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((name) => (this.systemDisplayName = name));
  }

  readonly summary = computed(() => ({
    room: this.store.selectedRoom(),
    date: this.store.selectedDate(),
    startTime: this.store.selectedStartTime(),
    duration: this.store.selectedDuration(),
    needsGm: this.store.needsGm(),
    gmId: this.store.selectedGm(),
    systemId: this.store.selectedSystemId(),
    party: this.partyDisplayName,
  }));

  readonly formattedDate = computed(() => {
    const raw = this.store.selectedDate();
    return raw ? format(new Date(raw), 'dd.MM.yyyy') : '';
  });

  // ---- GM extra info (sekcja w podsumowaniu) ----
  readonly gmExtraInfo = computed<IGmExtraInfo | null>(() => this.store.gmExtraInfo?.() ?? null);
  readonly showGmExtraInfo = computed(
    () => this.store.needsGm() && !!this.store.wantsGmExtraInfo?.() && !!this.gmExtraInfo()
  );

  yesNo(v: boolean): string {
    return v ? 'Tak' : 'Nie';
  }
}
