import { Component, computed, inject, signal } from '@angular/core';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { Rooms } from '../../../../core/enums/rooms';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { SystemRole } from '../../../../core/enums/systemRole';
import { TimeSlots } from '../../../../core/enums/hours';
import { of, combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  switchMap,
  startWith,
  map,
} from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { PartyService } from '../../../core/services/party/party.service';

type GmChoice = 'party' | 'manual';

@Component({
  selector: 'app-time-selection',
  standalone: true,
  imports: [],
  templateUrl: './time-selection.component.html',
  styleUrl: './time-selection.component.scss',
})
export class TimeSelectionComponent {
  private readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);
  private readonly partyService = inject(PartyService);

  readonly selectedTime = signal<string | null>(
    this.store.selectedStartTime() ?? null
  );
  readonly selectedDuration = signal<number>(
    this.store.selectedDuration() ?? 1
  );
  readonly needsGm = signal<boolean>(this.store.needsGm());
  readonly reservations = signal<IReservation[]>([]);

  readonly selectedPartyId = this.store.selectedPartyId;
  readonly partyGmId = signal<string | null>(null);
  readonly gmChoice = signal<GmChoice>('manual');
  private readonly gmChoiceTouched = signal(false);

  readonly isJoinStage1 = signal<boolean>(false);

  constructor() {
    const date = this.store.selectedDate();
    const room = this.store.selectedRoom();
    if (date && room) {
      this.reservationService
        .getReservationsForRoom(room, date)
        .subscribe((res) => this.reservations.set(res));
    }

    // Zmiana drużyny: pobierz GM + flagę programu
    toObservable(this.store.selectedPartyId)
      .pipe(
        distinctUntilChanged(),
        switchMap((pid) =>
          pid
            ? this.partyService
                .getPartyById(pid)
                .pipe(map((team) => ({ pid, team })))
            : of({ pid: null as string | null, team: null })
        )
      )
      .subscribe(({ pid, team }) => {
        const gmId = team?.gmId ?? null;
        this.partyGmId.set(gmId);
        this.isJoinStage1.set(
          !!team?.beginnersProgram && team?.programStage === 1
        );

        if (this.needsGm() && !this.gmChoiceTouched()) {
          if (pid && gmId) {
            this.gmChoice.set('party');
            this.store.selectedGm.set(gmId);
          } else {
            this.gmChoice.set('manual');
            this.store.selectedGm.set(null);
          }
        }

        // Jeżeli już był wybrany start – sprawdź, czy 4h pasuje
        if (this.isJoinStage1()) {
          const h = this.selectedHour();
          if (h != null) {
            if (this.isRangeFree(h, 4)) {
              this.selectedDuration.set(4);
              this.store.selectedDuration.set(4);
            } else {
              this.store.selectedDuration.set(null);
            }
          } else {
            this.store.selectedDuration.set(null);
          }
        }
      });

    toObservable(this.store.selectedPartyId)
      .pipe(
        distinctUntilChanged(),
        switchMap((pid) =>
          pid
            ? this.partyService
                .getPartyById(pid)
                .pipe(map((team) => ({ pid, team })))
            : of({ pid: null as string | null, team: null })
        )
      )
      .subscribe(({ pid, team }) => {
        const gmId = team?.gmId ?? null;
        const join = !!team?.beginnersProgram && team?.programStage === 1;
        this.isJoinStage1.set(join);
        this.partyGmId.set(gmId);

        // AUTO: Join → zawsze z MG
        if (join) {
          this.store.needsGm.set(true);
          if (gmId) this.store.selectedGm.set(gmId);
          if (pid) {
            this.partyService.getPartySystems(pid).subscribe((systems) => {
              const first = systems[0]?.id ?? null;
              this.store.selectedSystemId.set(first);
            });
          }
        } else {
          // zachowanie dotychczasowe dla nie-Join
          if (this.needsGm() && !this.gmChoiceTouched()) {
            if (pid && gmId) {
              this.gmChoice.set('party');
              this.store.selectedGm.set(gmId);
            } else {
              this.gmChoice.set('manual');
              this.store.selectedGm.set(null);
            }
          }
        }

        if (join) {
          const h = this.selectedHour();
          if (h != null) {
            if (this.isRangeFree(h, 4)) {
              this.selectedDuration.set(4);
              this.store.selectedDuration.set(4);
            } else {
              this.store.selectedDuration.set(null);
            }
          } else {
            this.store.selectedDuration.set(null);
          }
        }
      });

    toObservable(this.needsGm)
      .pipe(startWith(this.needsGm()), distinctUntilChanged())
      .subscribe((on) => {
        if (!on) {
          this.gmChoice.set('manual');
          this.gmChoiceTouched.set(false);
          this.store.needsGm.set(false);
          this.store.selectedGm.set(null);
          return;
        }
        this.store.needsGm.set(true);
        if (!this.gmChoiceTouched()) {
          const pid = this.selectedPartyId();
          const gmId = this.partyGmId();
          if (pid && gmId) {
            this.gmChoice.set('party');
            this.store.selectedGm.set(gmId);
          } else {
            this.gmChoice.set('manual');
            this.store.selectedGm.set(null);
          }
        }
      });

    // Spójność selectedGm przy „party”
    combineLatest([
      toObservable(this.partyGmId),
      toObservable(this.store.selectedPartyId),
      toObservable(this.needsGm),
    ]).subscribe(([gmId, pid, needs]) => {
      if (needs && this.gmChoice() === 'party') {
        this.store.selectedGm.set(pid && gmId ? gmId : null);
      }
    });
  }

  // Role
  readonly isPrivilegedUser = computed(
    () =>
      [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(
        this.auth.userCoworkerRole()!
      ) || this.auth.userSystemRole() === SystemRole.Admin
  );

  readonly isMemberRestrictedClubRoom = computed(() => {
    const room = this.store.selectedRoom();
    const role = this.auth.userCoworkerRole();
    return (
      [Rooms.Asgard, Rooms.Alfheim].includes(room) &&
      (role === CoworkerRoles.Member || this.isPrivilegedUser())
    );
  });

  // Godziny dnia
  readonly startHour = computed(() => {
    if (this.store.isReceptionMode()) return TimeSlots.noonStart;
    return this.isMemberRestrictedClubRoom()
      ? TimeSlots.earlyStart
      : TimeSlots.lateStart;
  });
  readonly endHour = computed(() => TimeSlots.end);

  // Maksymalna długość (w Join stage 1 zawsze 4)
  readonly maxDur = computed(() => {
    if (this.isJoinStage1()) return 4;
    if (this.store.isReceptionMode()) return 11;
    return this.isMemberRestrictedClubRoom() ? 4 : 6;
  });

  // Siatka 1h
  readonly timeSlots = computed(() => {
    const start = this.startHour();
    const end = this.endHour();
    const len = end - start;

    // baza: wolność co godzinę
    const base = Array<boolean>(len).fill(true);
    for (const r of this.reservations()) {
      const s = parseInt(r.startTime.split(':')[0], 10);
      for (let i = 0; i < r.durationHours; i++) {
        const idx = s + i - start;
        if (idx >= 0 && idx < len) base[idx] = false;
      }
    }

    // przy Join stage 1 wymagamy od razu 4h ciągiem
    const requiredDur = this.isJoinStage1() ? 4 : 1;

    return Array.from({ length: len }, (_, i) => {
      let available = base[i];
      if (available && requiredDur > 1) {
        if (i + requiredDur > len) {
          available = false;
        } else {
          for (let k = 0; k < requiredDur; k++) {
            if (!base[i + k]) {
              available = false;
              break;
            }
          }
        }
      }
      return { hour: start + i, available };
    });
  });

  // Overlap + zakres wolny
  private overlaps(aStart: number, aDur: number, bStart: number, bDur: number) {
    const aEnd = aStart + aDur;
    const bEnd = bStart + bDur;
    return aStart < bEnd && aEnd > bStart;
  }
  private isRangeFree(h: number, dur: number): boolean {
    const start = this.startHour();
    const end = this.endHour();
    if (h < start || h + dur > end) return false;
    for (const r of this.reservations()) {
      const rs = parseInt(r.startTime.split(':')[0], 10);
      if (this.overlaps(h, dur, rs, r.durationHours)) return false;
    }
    return true;
  }

  // Wybrana godzina
  readonly selectedHour = computed(() => {
    const [h] = this.selectedTime()?.split(':') ?? [];
    return h ? parseInt(h, 10) : null;
  });

  // Dostępne długości
  readonly durations = computed(() => {
    if (this.isJoinStage1()) {
      const h = this.selectedHour();
      return h != null && this.isRangeFree(h, 4) ? [4] : [];
    }

    const hour = this.selectedHour();
    if (hour === null) return [];
    const start = this.startHour();
    const idx = hour - start;
    const out: number[] = [];
    for (
      let len = 1;
      len <= this.maxDur() && idx + len <= this.timeSlots().length;
      len++
    ) {
      const slice = this.timeSlots().slice(idx, idx + len);
      if (slice.every((s) => s.available)) out.push(len);
      else break;
    }
    return out;
  });

  // Akcje
  selectTime(hour: number) {
    const time = `${String(hour).padStart(2, '0')}:00`;
    this.selectedTime.set(time);
    this.store.selectedStartTime.set(time);

    if (this.isJoinStage1()) {
      // ustaw 4h tylko jeśli się mieści
      if (this.isRangeFree(hour, 4)) {
        this.selectedDuration.set(4);
        this.store.selectedDuration.set(4);
      } else {
        this.store.selectedDuration.set(null);
      }
    } else {
      this.selectedDuration.set(1);
      this.store.selectedDuration.set(1);
    }
  }

  selectDuration(duration: number) {
    if (this.isJoinStage1()) {
      this.selectedDuration.set(4);
      this.store.selectedDuration.set(4);
      return;
    }
    this.selectedDuration.set(duration);
    this.store.selectedDuration.set(duration);
  }

  toggleNeedsGm() {
    const updated = !this.needsGm();
    this.needsGm.set(updated);
  }

  choosePartyGm() {
    this.gmChoiceTouched.set(true);
    const gmId = this.partyGmId();
    this.gmChoice.set('party');
    this.store.selectedGm.set(gmId ?? null);
  }

  chooseManualGm() {
    this.gmChoiceTouched.set(true);
    this.gmChoice.set('manual');
    this.store.selectedGm.set(null);
  }

  readonly canProceed = computed(
    () => !!this.store.selectedStartTime() && !!this.store.selectedDuration()
  );
}
