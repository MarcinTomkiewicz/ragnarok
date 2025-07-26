import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

@Component({
  selector: 'app-gm-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gm-selection.component.html',
  styleUrl: './gm-selection.component.scss',
})
export class GmSelectionComponent {
  readonly store = inject(ReservationStoreService);
  private readonly backend = inject(BackendService);
  private readonly fb = inject(FormBuilder);

  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]);

  readonly form: FormGroup = this.fb.group({
    systemId: [this.store.selectedSystemId()],
  });

  readonly canProceed = computed(() => {
    const gmId = this.store.selectedGm();
    const gm = this.gms().find((g) => g.userId === gmId);
    return !!gmId && !!gm?.firstName && !!this.form.value.systemId;
  });

  constructor() {
    this.loadSystems();

    const currentSystemId = this.store.selectedSystemId();
    if (currentSystemId) {
      this.form.get('systemId')?.setValue(currentSystemId, { emitEvent: false });
      this.loadGmsForSystem(currentSystemId);
    }

    this.form.get('systemId')?.valueChanges.subscribe((systemId: string | null) => {
      this.store.selectedSystemId.set(systemId);
      if (systemId) {
        this.loadGmsForSystem(systemId);
      } else {
        this.gms.set([]);
        this.store.selectedGm.set(null);
        this.store.gmFirstName.set(null);
      }
    });
  }

  private loadSystems() {
    this.backend
      .getAll<IRPGSystem>('systems', 'name')
      .subscribe((systems) => this.systems.set(systems));
  }

  private loadGmsForSystem(systemId: string) {
    this.backend
      .getAll<IGmData>('v_gm_specialties_with_user')
      .subscribe((records) => {
        const filtered = records.filter((r) => r.systemId === systemId);
        this.gms.set(filtered);

        const existingId = this.store.selectedGm();
        const stillExists = filtered.some((g) => g.userId === existingId);
        if (!stillExists) {
          this.store.selectedGm.set(null);
          this.store.gmFirstName.set(null);
        }
      });
  }

  selectGm(gmId: string) {
    const gm = this.gms().find((g) => g.userId === gmId);
    this.store.selectedGm.set(gmId);
    if (gm?.firstName) {
      this.store.gmFirstName.set(gm.firstName);
    }
  }
}
