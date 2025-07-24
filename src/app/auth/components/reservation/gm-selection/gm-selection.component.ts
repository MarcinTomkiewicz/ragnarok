import { Component, inject, signal, output } from '@angular/core';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';

@Component({
  selector: 'app-gm-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gm-selection.component.html',
  styleUrl: './gm-selection.component.scss',
})
export class GmSelectionComponent {
  private readonly backend = inject(BackendService);
  private readonly fb = inject(FormBuilder);

  readonly gmSelected = output<{ id: string; firstName: string }>();
  readonly goBack = output<void>();

  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]);
  readonly selectedGmId = signal<string | null>(null); // ← brakowało tego

  readonly form: FormGroup = this.fb.group({
    systemId: [null],
  });

  constructor() {
    this.loadSystems();

    this.form.get('systemId')?.valueChanges.subscribe((systemId: string | null) => {
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
    this.backend.getAll<IGmData>('v_gm_specialties_with_user').subscribe((records) => {
      const filtered = records.filter((r) => r.systemId === systemId);
      this.gms.set(filtered);
    });
  }

  confirm() {
    const selectedId = this.selectedGmId();
    const gm = this.gms().find((g) => g.userId === selectedId);

    if (selectedId && gm?.firstName) {
      this.gmSelected.emit({
        id: selectedId,
        firstName: gm.firstName,
      });
    }
  }

  handleBack() {
    this.goBack.emit();
  }
}
