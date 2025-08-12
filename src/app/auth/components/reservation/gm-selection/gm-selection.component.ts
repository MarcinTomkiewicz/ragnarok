import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { GmService } from '../../../core/services/gm/gm.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GmDetailsModalComponent } from '../../../../common/gm-details-modal/gm-details-modal.component';
import { GmPickSlotModalComponent } from '../../../common/gm-pick-slot-modal/gm-pick-slot-modal.component';
import { of, startWith, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-gm-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gm-selection.component.html',
  styleUrl: './gm-selection.component.scss',
})
export class GmSelectionComponent {
  readonly store = inject(ReservationStoreService);
  private readonly fb = inject(FormBuilder);
  private readonly reservationService = inject(ReservationService);
  private readonly gmService = inject(GmService);
  private readonly modal = inject(NgbModal);

  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]);
  readonly allAvailableGms = signal<IGmData[]>([]);
  showAllGmsButton = signal(false);
  readonly showAll = signal(false);
  readonly showSystemGms = signal(false);

  readonly form: FormGroup = this.fb.group({
    systemId: [this.store.selectedSystemId()],
  });

  readonly canProceed = computed(() => {
    const gmId = this.store.selectedGm();
    const gm = this.gms().find((g) => g.userId === gmId);
    return !!gmId && !!this.form.value.systemId;
  });

  private readonly systemId$ = this.form
    .get('systemId')!
    .valueChanges.pipe(
      startWith(this.form.get('systemId')!.value as string | null)
    );

  private readonly gmsForSystemAll$ = this.systemId$.pipe(
    switchMap((systemId) =>
      systemId
        ? this.reservationService.getGmsForSystem(systemId)
        : of([] as IGmData[])
    )
  );

  readonly systemGms = computed(() => {
    const now = new Set(this.gms().map((g) => g.userId));
    return this.gmsForSystemAll().filter((g) => !now.has(g.userId));
  });

  readonly gmsForSystemAll = toSignal(this.gmsForSystemAll$, {
    initialValue: [] as IGmData[],
  });

  constructor() {
    this.reservationService.getAllSystems().subscribe((systems) => {
      this.systems.set(systems);
    });

    const currentSystemId = this.store.selectedSystemId();
    if (currentSystemId) {
      this.form
        .get('systemId')
        ?.setValue(currentSystemId, { emitEvent: false });
      this.loadGms(currentSystemId);
    }

    this.form
      .get('systemId')
      ?.valueChanges.subscribe((systemId: string | null) => {
        this.store.selectedSystemId.set(systemId);
        this.allAvailableGms.set([]);
        this.showAll.set(false);
        this.showSystemGms.set(false);
        if (systemId) this.loadGms(systemId);
        else {
          this.gms.set([]);
          this.store.selectedGm.set(null);
        }
      });
  }

  readonly visibleAllGms = computed(() =>
    this.showAll() ? this.allAvailableGms() : this.allAvailableGms().slice(0, 4)
  );

  readonly visibleGms = computed(() =>
    this.showAll() ? this.gms() : this.gms().slice(0, 4)
  );

  readonly shouldShowMoreButton = computed(() => {
    return !this.showAll() && this.gms().length > 4;
  });

  readonly shouldShowMoreGmsButton = computed(() => {
    return !this.showAll() && this.allAvailableGms().length > 4;
  });

  private loadGms(
    systemId: string,
    opts: { preserveSelectedGm?: boolean } = {}
  ) {
    const { preserveSelectedGm = false } = opts;

    const date = this.store.selectedDate();
    const startTime = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();

    this.gms.set([]);
    if (!preserveSelectedGm) this.store.selectedGm.set(null);
    this.showAllGmsButton.set(false);

    if (!date || !startTime || duration == null) return;

    const startHour = parseInt(startTime, 10);
    this.reservationService
      .getAvailableGmsForSystem(systemId, date, startHour, duration)
      .subscribe((gms) => {
        this.gms.set(gms);
        if (gms.length === 0) this.showAllGmsButton.set(true);
      });
  }

  showAllAvailableGms() {
    if (this.showSystemGms()) this.showSystemGms.set(false);

    const date = this.store.selectedDate();
    const startTime = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();
    if (!date || !startTime || duration == null) return;

    const startHour = parseInt(startTime, 10);
    this.reservationService
      .getAllGmsForTimeRange(date, startHour, duration)
      .subscribe((gms) => this.allAvailableGms.set(gms));
  }

  selectGm(gmId: string) {
    this.store.selectedGm.set(gmId);
  }

  gmDisplayName(gm: IGmData): string {
    return this.gmService.gmDisplayName(gm);
  }

  onCardClick(gm: IGmData): void {
    const modalRef = this.modal.open(GmDetailsModalComponent, {
      size: 'lg',
      centered: true,
    });
    modalRef.componentInstance.gm = gm;
  }

  openPickSlotModal(gm: IGmData) {
    const date = this.store.selectedDate();
    const start = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();
    if (!date || !start || duration == null) return;

    const allowPrevDay = this.isAtLeast48hAhead(date);

    const ref = this.modal.open(GmPickSlotModalComponent, {
      size: 'lg',
      centered: true,
    });
    const cmp = ref.componentInstance as GmPickSlotModalComponent;
    cmp.gm = gm;
    cmp.preferredDate = date;
    cmp.preferredStartHour = parseInt(start, 10);
    cmp.duration = duration;
    cmp.allowPrevDay = allowPrevDay;

    cmp.confirm.subscribe((slot) => {
      this.store.selectedDate.set(slot.date);
      this.store.selectedStartTime.set(
        String(slot.startHour).padStart(2, '0') + ':00'
      );
      this.store.selectedDuration.set(slot.duration);
      this.store.selectedGm.set(gm.userId);
      this.store.saveToStorage();
      ref.close();

      const systemId = this.form.get('systemId')?.value as string | null;
      if (systemId) this.loadGms(systemId, { preserveSelectedGm: true });

      this.showSystemGms.set(false);
    });

    cmp.close.subscribe(() => ref.dismiss());
  }

  private isAtLeast48hAhead(date: string): boolean {
    const now = new Date();
    const target = new Date(date + 'T00:00:00');
    return target.getTime() - now.getTime() >= 48 * 60 * 60 * 1000;
  }

  showOnlySystemGms() {
    if (!this.showSystemGms()) {
      this.showAll.set(false);
      this.allAvailableGms.set([]);
    }
    this.showSystemGms.set(true);
  }

  showOnlyAvailableNow() {
    if (this.showSystemGms()) {
      this.showSystemGms.set(false);
    }
    this.showAll.set(false);
    this.showAllAvailableGms();
  }
}
