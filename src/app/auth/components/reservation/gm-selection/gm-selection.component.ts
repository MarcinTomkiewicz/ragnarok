import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { GmService } from '../../../core/services/gm/gm.service';

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
  private readonly gmService = inject(GmService)

  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]);

  readonly form: FormGroup = this.fb.group({
    systemId: [this.store.selectedSystemId()],
  });

  readonly canProceed = computed(() => {
    const gmId = this.store.selectedGm();
    const gm = this.gms().find((g) => g.userId === gmId);
    return !!gmId && !!this.form.value.systemId;
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
        if (systemId) {
          this.loadGms(systemId);
        } else {
          this.gms.set([]);
          this.store.selectedGm.set(null);
        }
      });
  }

  private loadGms(systemId: string) {
    const date = this.store.selectedDate();
    const startTime = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();

    this.gms.set([]);
    this.store.selectedGm.set(null);

    if (!date || !startTime || duration == null) {
      return;
    }

    const startHour = parseInt(startTime, 10);

    this.reservationService
      .getAvailableGmsForSystem(systemId, date, startHour, duration)
      .subscribe((gms) => {
        this.gms.set(gms);
      });
  }

  selectGm(gmId: string) {
    // const gm = this.gms().find((g) => g.userId === gmId);
    this.store.selectedGm.set(gmId);
  }

  gmDisplayName(gm: IGmData): string {
    return this.gmService.gmDisplayName(gm);
  }
}
