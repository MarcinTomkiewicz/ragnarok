import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { signal } from '@angular/core';

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

  constructor() {
    this.loadSystems();

    const currentSystemId = this.store.selectedSystemId();
    if (currentSystemId) this.loadGmsForSystem(currentSystemId);

    console.log(this.store.selectedGm(), this.gms());
    

    this.form.get('systemId')?.valueChanges.subscribe((systemId: string | null) => {
      this.store.selectedSystemId.set(systemId);

      if (systemId) {
        this.loadGmsForSystem(systemId);
      } else {
        this.gms.set([]);
        this.store.selectedGm.set(null);
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
        if (!stillExists) this.store.selectedGm.set(null);
      });
  }

  confirm() {
    const id = this.store.selectedGm();
    const gm = this.gms().find((g) => g.userId === id);
    const systemId = this.store.selectedSystemId();

    if (id && gm?.firstName && systemId) {
      this.store.gmFirstName.set(gm.firstName);
      this.store.step.set(4);
    }
  }

  handleBack() {
    this.store.step.set(2);
  }
}
