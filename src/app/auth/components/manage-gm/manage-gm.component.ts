import {
  Component,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, of, switchMap } from 'rxjs';
import { BackendService } from '../../../core/services/backend/backend.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';
import { GmService } from '../../core/services/gm/gm.service';

@Component({
  selector: 'app-manage-gm',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manage-gm.component.html',
  styleUrl: './manage-gm.component.scss',
})
export class ManageGmComponent {
  private readonly backend = inject(BackendService);
  private readonly imageStorage = inject(ImageStorageService);
  private readonly gmService = inject(GmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);

  readonly user = this.auth.user()!;
  readonly systems = signal<IRPGSystem[]>([]);
  readonly previousImagePath = signal<string | null>(null);
  imagePreview = signal<string | null>(null);

  readonly successToast = viewChild<TemplateRef<unknown>>('editDataSuccess');

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

      // Zakładamy, że `processImage` był już wywołany w BackendService.getAll
      const profile = userRecords[0];

      this.form.get('experience')?.setValue(profile.experience ?? '');

      if (profile.image) {
        this.previousImagePath.set(profile.image);
        this.imagePreview.set(profile.image); // już zoptymalizowane URL przez processImage
      }

      const ids = userRecords.map((r) => r.systemId);
      ids.slice(0, 5).forEach((id, i) => {
        this.systemControls.at(i)?.setValue(id);
      });
    });
}

  isSystemSelectedElsewhere(systemId: string, currentIndex: number): boolean {
    return this.systemControls.controls.some(
      (ctrl, idx) => idx !== currentIndex && ctrl.value === systemId
    );
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      if (img.width !== 250 || img.height !== 250) {
        alert('Obrazek musi mieć dokładnie 250x250 pikseli.');
        return;
      }

      if (file.type !== 'image/avif') {
        alert('Dozwolony format to tylko .avif.');
        return;
      }

      this.imagePreview.set(url);
      this.form.get('image')?.setValue(file);
    };
  }

  submitProfile() {
    const experience = this.form.get('experience')?.value;
    const systems = this.systemControls.value.filter(Boolean);
    const file: File | null = this.form.get('image')?.value;
    const previous = this.previousImagePath();

    const upload$: Observable<string | null> = file
      ? this.imageStorage.uploadOrReplaceImage(file, `gms/${this.user.id}`, previous)
      : of(previous);

    upload$
      .pipe(
        switchMap((imagePath) => {
          const payload: any = {
            id: this.user.id,
            experience,
          };

          // tylko jeśli obrazek był przesłany lub już był – dołącz go
          if (imagePath) payload.image = imagePath;

          return this.backend.upsert('gm_profiles', payload);
        }),
        switchMap(() => this.gmService.updateSpecialties(this.user.id, systems))
      )
      .subscribe({
        next: () => {
          const template = this.successToast();
          if (template) {
            this.toastService.show({
              template,
              classname: 'bg-success text-white',
              header: 'Zaktualizowano!',
            });
          }
        },
        error: (err) => {
          console.error('❌ Błąd przy zapisie profilu lub specjalizacji:', err);
        },
      });
  }
}
