import { Component, inject } from '@angular/core';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { signal, output } from '@angular/core';
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

  readonly gmSelected = output<string>();
  readonly goBack = output<void>();

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
          console.log('Selected system ID:', systemId);
          
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
        const filtered = records.filter(
          (r) => r.systemId === systemId
        );
        console.log(records, systemId, filtered);
        
        this.gms.set(filtered);
      });
  }

  confirm() {
    if (this.selectedGmId()) {
      this.gmSelected.emit(this.selectedGmId()!);
    }
  }

  handleBack() {
    this.goBack.emit();
  }
}
