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
import { distinctUntilChanged, switchMap, startWith, map } from 'rxjs/operators';
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

  // PARTY + GM defaulting
  readonly selectedPartyId = this.store.selectedPartyId; // proxy do templatki
  readonly partyGmId = signal<string | null>(null);
  readonly gmChoice = signal<GmChoice>('manual');
  private readonly gmChoiceTouched = signal(false);

  constructor() {
    const date = this.store.selectedDate();
    const room = this.store.selectedRoom();
    if (date && room) {
      this.reservationService
        .getReservationsForRoom(room, date)
        .subscribe((res) => this.reservations.set(res));
    }

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

        if (this.needsGm() && !this.gmChoiceTouched()) {
          if (pid && gmId) {
            this.gmChoice.set('party');
            this.store.selectedGm.set(gmId);
          } else {
            this.gmChoice.set('manual');
            this.store.selectedGm.set(null);
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

  // Roles
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

  // Time logic
  readonly startHour = computed(() => {
    if (this.store.isReceptionMode()) return TimeSlots.noonStart;
    return this.isMemberRestrictedClubRoom()
      ? TimeSlots.earlyStart
      : TimeSlots.lateStart;
  });

  readonly maxDur = computed(() => {
    if (this.store.isReceptionMode()) return 11;
    return this.isMemberRestrictedClubRoom() ? 4 : 6;
  });

  readonly endHour = computed(() => TimeSlots.end);

  readonly timeSlots = computed(() => {
    const start = this.startHour();
    const end = this.endHour();
    const slots = Array(end - start).fill(true);
    for (const res of this.reservations()) {
      const startRes = Number(res.startTime.split(':')[0]);
      for (let i = 0; i < res.durationHours; i++) {
        const idx = startRes + i - start;
        if (idx >= 0 && idx < slots.length) slots[idx] = false;
      }
    }
    return slots.map((available, i) => ({ hour: start + i, available }));
  });

  readonly selectedHour = computed(() => {
    const [hourStr] = this.selectedTime()?.split(':') ?? [];
    return hourStr ? parseInt(hourStr, 10) : null;
  });

  readonly durations = computed(() => {
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

  // Actions
  selectTime(hour: number) {
    const time = `${String(hour).padStart(2, '0')}:00`;
    this.selectedTime.set(time);
    this.selectedDuration.set(1);
    this.store.selectedStartTime.set(time);
    this.store.selectedDuration.set(1);
  }

  selectDuration(duration: number) {
    this.selectedDuration.set(duration);
    this.store.selectedDuration.set(duration);
  }

  toggleNeedsGm() {
    const updated = !this.needsGm();
    this.needsGm.set(updated);
    // reszta logiki defaultowania dzieje się w subskrypcji needsGm powyżej
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

  // Stepper
  readonly canProceed = computed(
    () => !!this.store.selectedStartTime() && this.store.selectedDuration()
  );
}
