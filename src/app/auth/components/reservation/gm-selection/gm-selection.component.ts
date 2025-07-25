import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
  private readonly store = inject(ReservationStoreService);
  private readonly backend = inject(BackendService);
  private readonly fb = inject(FormBuilder);

  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]);

  readonly selectedGmId = signal<string | null>(this.store.selectedGm());
  readonly selectedSystemId = signal<string | null>(
    this.store.selectedSystemId()
  );

  readonly form: FormGroup = this.fb.group({
    systemId: [this.selectedSystemId()],
  });

  constructor() {
    this.loadSystems();

    const currentSystemId = this.selectedSystemId();
    if (currentSystemId) this.loadGmsForSystem(currentSystemId);

    this.form
      .get('systemId')
      ?.valueChanges.subscribe((systemId: string | null) => {
        this.selectedSystemId.set(systemId);

        if (systemId) {
          this.loadGmsForSystem(systemId);
        } else {
          this.gms.set([]);
          this.selectedGmId.set(null);
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
        this.selectedGmId.set(stillExists ? existingId : null);
      });
  }

  confirm() {
    const id = this.selectedGmId();
    const gm = this.gms().find((g) => g.userId === id);
    const systemId = this.selectedSystemId();

    if (id && gm?.firstName && systemId) {
      this.store.selectedGm.set(id);
      this.store.gmFirstName.set(gm.firstName);
      this.store.selectedSystemId.set(systemId);
      this.store.step.set(4);
    }
  }

  handleBack() {
    this.store.step.set(2);
  }
}
