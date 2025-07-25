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
  readonly selectedGmId = signal<string | null>(null);

  readonly form: FormGroup = this.fb.group({
    systemId: [null],
  });

  constructor() {
    this.loadSystems();

    this.form
      .get('systemId')
      ?.valueChanges.subscribe((systemId: string | null) => {
        if (systemId) {
          this.loadGmsForSystem(systemId);
        } else {
          this.gms.set([]);
          this.selectedGmId.set(null);
        }
      });
  }

  loadSystems() {
    this.backend.getAll<IRPGSystem>('systems', 'name').subscribe((systems) => {
      this.systems.set(systems);
    });
  }

  loadGmsForSystem(systemId: string) {
    this.backend
      .getAll<IGmData>('v_gm_specialties_with_user')
      .subscribe((records) => {
        const filtered = records.filter((r) => r.systemId === systemId);
        this.gms.set(filtered);
      });
  }

  confirm() {
    const selectedId = this.selectedGmId();
    const gm = this.gms().find((g) => g.userId === selectedId);
    const selectedSystemId = this.form.get('systemId')?.value;

    if (selectedId && gm?.firstName) {
      this.store.selectedGm.set(gm.userId);
      this.store.gmFirstName.set(gm.firstName);
      this.store.selectedSystemId?.set?.(selectedSystemId); // <- jeśli dodasz do store
      this.store.step.set(4);
    }
  }

  handleBack() {
    this.store.step.set(2);
  }
}
