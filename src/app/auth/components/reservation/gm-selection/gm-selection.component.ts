import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  toObservable,
  toSignal,
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, forkJoin, of } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';

import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IUser } from '../../../../core/interfaces/i-user';

import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { GmService } from '../../../core/services/gm/gm.service';
import { PartyService } from '../../../core/services/party/party.service';

import { GmDetailsModalComponent } from '../../../../common/gm-details-modal/gm-details-modal.component';
import { GmPickSlotModalComponent } from '../../../common/gm-pick-slot-modal/gm-pick-slot-modal.component';

@Component({
  selector: 'app-gm-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gm-selection.component.html',
  styleUrl: './gm-selection.component.scss',
})
export class GmSelectionComponent {
  // DI
  readonly store = inject(ReservationStoreService);
  private readonly fb = inject(FormBuilder);
  private readonly reservationService = inject(ReservationService);
  private readonly gmService = inject(GmService);
  private readonly partyService = inject(PartyService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);

  // Dane
  readonly allSystems = signal<IRPGSystem[]>([]);
  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]);
  readonly allAvailableGms = signal<IGmData[]>([]);
  readonly bySystemName = new Intl.Collator('pl', {
    sensitivity: 'base',
    numeric: true,
  }).compare;
  readonly supportedSystems = signal<IRPGSystem[]>([]);

  // Tryb „zablokowanego” MG
  readonly lockedGm = signal<IGmData | null>(null);
  readonly lockedGmUser = signal<IUser | null>(null);
  readonly lockedGmWarn = signal<boolean>(false);

  // UI
  readonly showAll = signal(false);
  readonly showSystemGms = signal(false);
  readonly showAllGmsButton = signal(false);

  // Form
  readonly form: FormGroup = this.fb.group({
    systemId: [this.store.selectedSystemId()],
  });

  readonly isPartyGmLocked = computed(
    () =>
      !!this.store.selectedPartyId() &&
      !!this.store.selectedGm() &&
      this.store.needsGm()
  );

  readonly canProceed = computed(
    () => !!this.store.selectedGm() && !!this.form.value.systemId
  );

  private get startHour(): number | null {
    const t = this.store.selectedStartTime();
    if (!t) return null;
    const [h] = t.split(':');
    return Number(h);
  }

  constructor() {
    forkJoin({
      all: this.reservationService.getAllSystems(),
      supported: this.gmService.getSystemsWithAtLeastOneGm(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ all, supported }) => {
        const by = this.bySystemName;
        const allSorted = [...all].sort((a, b) => by(a.name, b.name));
        const supportedSorted = [...supported].sort((a, b) =>
          by(a.name, b.name)
        );

        this.allSystems.set(allSorted);
        this.supportedSystems.set(supportedSorted);

        if (!this.isPartyGmLocked()) this.systems.set(this.supportedSystems());

        const ctrl = this.form.get('systemId')!;
        const sel = ctrl.value as string | null;
        const isSupported =
          !!sel && this.supportedSystems().some((s) => s.id === sel);

        if (!isSupported) {
          ctrl.setValue(null, { emitEvent: true });
          this.store.selectedSystemId.set(null);
        }
      });

    toObservable(this.isPartyGmLocked)
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((locked) =>
        locked ? this.enterLockedMode() : this.exitLockedMode()
      );

    this.form
      .get('systemId')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((systemId: string | null) => {
        this.store.selectedSystemId.set(systemId);
        if (!this.isPartyGmLocked()) this.loadAvailableGmsForCurrent();
        else this.updateLockedGmAvailability();
      });

    const locked$ = toObservable(this.isPartyGmLocked).pipe(
      distinctUntilChanged()
    );
    const systemId$ = this.form
      .get('systemId')!
      .valueChanges.pipe(
        startWith(this.form.get('systemId')!.value as string | null),
        distinctUntilChanged()
      );

    const manualMode$ = toObservable(this.isPartyGmLocked).pipe(
      map((locked) => !locked),
      distinctUntilChanged()
    );

    const date$ = toObservable(this.store.selectedDate).pipe(filter(Boolean));
    const time$ = toObservable(this.store.selectedStartTime).pipe(
      filter(Boolean)
    );
    const dur$ = toObservable(this.store.selectedDuration).pipe(
      filter((n): n is number => n != null)
    );

    combineLatest([manualMode$, systemId$, date$, time$, dur$])
      .pipe(
        tap(([manual, systemId]) => {
          if (manual) this.store.selectedSystemId.set(systemId ?? null);
        }),
        filter(([manual, systemId]) => manual && !!systemId),
        switchMap(([_, systemId, date, startTime, duration]) =>
          this.gmService.getAvailableGmsForSystem(
            systemId as string,
            date as string,
            parseInt(startTime as string, 10),
            duration as number
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((gms) => {
        this.gms.set(gms);
        this.showAllGmsButton.set(gms.length === 0);
      });

    if (!this.isPartyGmLocked() && this.form.value.systemId) {
      this.loadAvailableGmsForCurrent();
    }
  }

  private enterLockedMode() {
    const gmId = this.store.selectedGm();
    if (!gmId) return;

    this.gmService
      .getGmById(gmId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (gm) => this.lockedGm.set(gm),
        error: () => this.lockedGm.set(null),
      });

    this.partyService
      .getPartyOwnerData(gmId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => this.lockedGmUser.set(u));

    this.gmService
      .getSystemsForGm(gmId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        const sorted = [...list].sort((a, b) =>
          this.bySystemName(a.name, b.name)
        );
        this.systems.set(sorted);
        const current = this.form.value.systemId as string | null;
        const allowed = new Set(sorted.map((s) => s.id));
        const next =
          current && allowed.has(current) ? current : sorted[0]?.id ?? null;
        this.form.get('systemId')!.setValue(next, { emitEvent: false });
        this.store.selectedSystemId.set(next);
        this.updateLockedGmAvailability();
      });

    this.gms.set([]);
    this.allAvailableGms.set([]);
    this.showAll.set(false);
    this.showSystemGms.set(false);
    this.showAllGmsButton.set(false);
  }

  private exitLockedMode() {
    this.lockedGm.set(null);
    this.lockedGmUser.set(null);
    this.lockedGmWarn.set(false);
    this.systems.set(this.supportedSystems());

    const ctrl = this.form.get('systemId')!;
    const sel = ctrl.value as string | null;
    const ok = !sel || this.supportedSystems().some((s) => s.id === sel);
    if (!ok) {
      ctrl.setValue(null, { emitEvent: true });
      this.store.selectedSystemId.set(null);
    }

    if (this.form.value.systemId) this.loadAvailableGmsForCurrent();
  }

  private updateLockedGmAvailability() {
    const gmId = this.store.selectedGm();
    const systemId = this.form.value.systemId as string | null;
    const date = this.store.selectedDate();
    const startHour = this.startHour;
    const duration = this.store.selectedDuration();

    if (!gmId || !systemId || !date || startHour == null || duration == null) {
      this.lockedGmWarn.set(false);
      return;
    }

    this.gmService
      .getAvailableGmsForSystem(systemId, date, startHour, duration)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        const ok = list.some((g) => g.userId === gmId);
        this.lockedGmWarn.set(!ok);
      });
  }

  private loadAvailableGmsForCurrent() {
    const systemId = this.form.value.systemId as string | null;
    const date = this.store.selectedDate();
    const startHour = this.startHour;
    const duration = this.store.selectedDuration();

    if (!systemId || !date || startHour == null || duration == null) {
      this.gms.set([]);
      this.showAllGmsButton.set(false);
      return;
    }

    this.gms.set([]);
    this.store.selectedGm.set(null);
    this.showAllGmsButton.set(false);

    this.gmService
      .getAvailableGmsForSystem(systemId, date, startHour, duration)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((gms) => {
        this.gms.set(gms);
        if (gms.length === 0) this.showAllGmsButton.set(true);
      });
  }

  selectGm(gmId: string) {
    this.store.selectedGm.set(gmId);
  }

  gmDisplayName(gm: IGmData | null): string {
    if (!gm) {
      const u = this.lockedGmUser();
      if (!u) return 'Mistrz Gry';
      return u.nickname && u.useNickname
        ? u.nickname
        : u.firstName ?? u.email ?? 'Mistrz Gry';
    }
    return this.gmService.gmDisplayName(gm);
  }

  onCardClick(gm: IGmData): void {
    const ref = this.modal.open(GmDetailsModalComponent, {
      size: 'lg',
      centered: true,
    });
    ref.componentInstance.gm = gm;
  }

  openPickSlotModal(gm: IGmData) {
    const date = this.store.selectedDate();
    const start = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();
    if (!date || !start || duration == null) return;

    const ref = this.modal.open(GmPickSlotModalComponent, {
      size: 'lg',
      centered: true,
    });
    const cmp = ref.componentInstance as GmPickSlotModalComponent;
    cmp.gm = gm;
    cmp.preferredDate = date;
    cmp.preferredStartHour = parseInt(start, 10);
    cmp.duration = duration;
    cmp.allowPrevDay = this.isAtLeast48hAhead(date);

    cmp.confirm.subscribe((slot) => {
      this.store.selectedDate.set(slot.date);
      this.store.selectedStartTime.set(
        String(slot.startHour).padStart(2, '0') + ':00'
      );
      this.store.selectedDuration.set(slot.duration);
      this.store.selectedGm.set(gm.userId);
      this.store.saveToStorage();

      const sysId = this.form.get('systemId')?.value as string | null;
      if (this.isPartyGmLocked()) this.updateLockedGmAvailability();
      else if (sysId) this.loadAvailableGmsForCurrent();

      ref.close();
      this.showSystemGms.set(false);
    });

    cmp.close.subscribe(() => ref.dismiss());
  }

  showOnlySystemGms() {
    if (!this.showSystemGms()) {
      this.showAll.set(false);
      this.allAvailableGms.set([]);
    }
    this.showSystemGms.set(true);
  }

  showOnlyAvailableNow() {
    if (this.showSystemGms()) this.showSystemGms.set(false);
    this.showAll.set(false);

    const date = this.store.selectedDate();
    const startHour = this.startHour;
    const duration = this.store.selectedDuration();
    if (!date || startHour == null || duration == null) return;

    this.gmService
      .getAllGmsForTimeRange(date, startHour, duration)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((gms) => this.allAvailableGms.set(gms));
  }

  private isAtLeast48hAhead(date: string): boolean {
    const now = new Date();
    const target = new Date(date + 'T00:00:00');
    return target.getTime() - now.getTime() >= 48 * 60 * 60 * 1000;
  }

  readonly gmsForSystemAll = toSignal(
    this.form.get('systemId')!.valueChanges.pipe(
      startWith(this.form.get('systemId')!.value as string | null), // ⬅️ DODANE
      distinctUntilChanged(),
      switchMap((systemId: string | null) =>
        systemId
          ? this.gmService.getGmsForSystem(systemId)
          : of([] as IGmData[])
      )
    ),
    { initialValue: [] as IGmData[] }
  );

  readonly systemGms = computed(() => {
    const now = new Set(this.gms().map((g) => g.userId));
    return this.gmsForSystemAll().filter((g) => !now.has(g.userId));
  });

  readonly visibleAllGms = computed(() =>
    this.showAll() ? this.allAvailableGms() : this.allAvailableGms().slice(0, 4)
  );

  readonly visibleGms = computed(() =>
    this.showAll() ? this.gms() : this.gms().slice(0, 4)
  );

  readonly shouldShowMoreButton = computed(
    () => !this.showAll() && this.gms().length > 4
  );

  readonly shouldShowMoreGmsButton = computed(
    () => !this.showAll() && this.allAvailableGms().length > 4
  );
}
