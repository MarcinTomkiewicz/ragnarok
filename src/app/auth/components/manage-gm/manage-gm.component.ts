import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';
import { BackendService } from '../../../core/services/backend/backend.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IGmData } from '../../../core/interfaces/i-gm-profile';

@Component({
  selector: 'app-manage-gm',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './manage-gm.component.html',
  styleUrl: './manage-gm.component.scss',
})
export class ManageGmComponent {
  private readonly backend = inject(BackendService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly user = this.auth.user()!;
  readonly systems = signal<IRPGSystem[]>([]);

  readonly form: FormGroup = this.fb.group({
    experience: [''],
    image: [null],
    systems: this.fb.array([...Array(5)].map(() => this.fb.control(''))),
  });

  get systemControls(): FormArray {
    return this.form.get('systems') as FormArray;
  }

  constructor() {
    this.loadAvailableSystems();
    this.loadExistingGmProfile();
  }

  private loadAvailableSystems() {
    this.backend
      .getAll<IRPGSystem>('systems', 'name')
      .subscribe((systems) => this.systems.set(systems));
  }

  private loadExistingGmProfile() {
    this.backend
      .getAll<IGmData>('v_gm_specialties_with_user')
      .subscribe((records) => {
        const userRecords = records.filter((r) => r.userId === this.user.id);
        if (!userRecords.length) return;

        const profile = userRecords[0];
        if (profile.experience) {
          this.form.get('experience')?.setValue(profile.experience);
        }

        const ids = userRecords.map((r) => r.systemId);
        ids.slice(0, 5).forEach((id, i) =>
          this.systemControls.at(i)?.setValue(id)
        );
      });
  }

  isSystemSelectedElsewhere(systemId: string, currentIndex: number): boolean {
    return this.systemControls.controls.some(
      (ctrl, idx) => idx !== currentIndex && ctrl.value === systemId
    );
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.form.get('image')?.setValue(file);
  }

  submitProfile() {
    const experience = this.form.get('experience')?.value;
    const systems = this.systemControls.value.filter(Boolean);
    const image = this.form.get('image')?.value;

    console.log('To save:', { experience, systems, image });

    // 🔸 Dodaj logikę POST/PUT do Supabase
  }
}
