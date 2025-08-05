import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import {
  IGmData,
} from '../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { GmService } from '../../core/services/gm/gm.service';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';

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

  readonly GmStyleTag = GmStyleTag;
  readonly GmStyleTagLabels = GmStyleTagLabels;

  readonly successToast = viewChild<TemplateRef<unknown>>('editDataSuccess');

  maxThreeStyles: ValidatorFn = (control) => {
    const array = control as FormArray;
    return array.length > 3 ? { maxTags: true } : null;
  };

  readonly form: FormGroup = this.fb.group({
    experience: [''],
    quote: ['', Validators.maxLength(160)],
    image: [null],
    systems: this.fb.array([...Array(5)].map(() => this.fb.control(''))),
    styleTags: this.fb.array([], this.maxThreeStyles),
  });

  get systemControls(): FormArray {
    return this.form.get('systems') as FormArray;
  }

  get styleTagControls(): FormArray {
    return this.form.get('styleTags') as FormArray;
  }

  get gmStyleTagValues(): GmStyleTag[] {
    return Object.values(GmStyleTag) as GmStyleTag[];
  }

  constructor() {
    this.loadAvailableSystems();
    this.loadExistingGmProfile();
  }

  private loadAvailableSystems() {
    this.backend.getAll<IRPGSystem>('systems', 'name').subscribe((systems) => {
      this.systems.set(systems);
    });
  }

  private loadExistingGmProfile() {
    this.backend
      .getAll<IGmData>(
        'v_gm_specialties_with_user',
        undefined,
        'asc',
        undefined,
        undefined,
        undefined,
        false
      )
      .subscribe((records) => {
        const userRecords = records.filter((r) => r.userId === this.user.id);
        if (!userRecords.length) return;

        const profile = userRecords[0];

        this.form.get('experience')?.setValue(profile.experience ?? '');
        this.form.get('quote')?.setValue(profile.quote ?? '');

        if (profile.image) {
          this.previousImagePath.set(profile.image);
          this.imagePreview.set(
            this.imageStorage.getOptimizedPublicUrl(profile.image, 250, 250)
          );
        }

        if (profile.styleTags?.length) {
          const array = this.form.get('styleTags') as FormArray;
          profile.styleTags
            .slice(0, 3)
            .forEach((tag) => array.push(this.fb.control(tag)));
        }

        const ids = userRecords.map((r) => r.systemId);
        ids.slice(0, 5).forEach((id, i) => {
          this.systemControls.at(i)?.setValue(id);
        });
      });
  }

  toggleStyleTag(tag: GmStyleTag) {
    const array = this.styleTagControls;
    const idx = array.value.indexOf(tag);
    if (idx >= 0) {
      array.removeAt(idx);
    } else if (array.length < 3) {
      array.push(this.fb.control(tag));
    }
  }

  enumKeys(obj: any): string[] {
    return Object.keys(obj).filter((k) => isNaN(Number(k)));
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
    const quote = this.form.get('quote')?.value;
    const systems = this.systemControls.value.filter(Boolean);
    const styleTags = this.styleTagControls.value;
    const file: File | null = this.form.get('image')?.value;
    const previous = this.previousImagePath();

    const upload$: Observable<string | null> = file
      ? this.imageStorage.uploadOrReplaceImage(
          file,
          `gms/${this.user.id}`,
          previous
        )
      : of(previous);

    upload$
      .pipe(
        switchMap((imagePath) => {
          const payload: any = {
            id: this.user.id,
            experience,
            quote,
            style_tags: styleTags,
          };

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
