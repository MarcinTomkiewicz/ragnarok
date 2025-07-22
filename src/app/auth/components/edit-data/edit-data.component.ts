import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  signal,
  TemplateRef,
  viewChild
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IUser } from '../../../core/interfaces/i-user';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoaderService } from '../../../core/services/loader/loader.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { sanitizeUserData } from '../../../core/utils/sanitize-user';
import { UserFormComponent } from '../../common/user-form/user-form.component';
import { createUserForm } from '../../factories/user-form.factory';

@Component({
  selector: 'app-edit-data',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UserFormComponent],
  templateUrl: './edit-data.component.html',
  styleUrls: ['./edit-data.component.scss'],
})
export class EditDataComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private loader = inject(LoaderService);
  private toastService = inject(ToastService);

  readonly user = signal<IUser | null>(null);
  readonly form = createUserForm(this.fb, true, false);
  readonly email = computed(() => this.user()?.email ?? '');
  errorMessage = signal<string | null>(null);

  readonly successToast = viewChild<TemplateRef<unknown>>('editedSuccessfully');

  constructor() {
    effect(() => {
      const currentUser = this.auth.user();

      if (currentUser) {
        this.form.patchValue(currentUser);
      }
    });
  }

  save(): void {
    if (this.form.invalid) return;

    const cleaned = sanitizeUserData(this.form.getRawValue());
    console.log('Saving user data:', cleaned);
    
    this.loader.show();
    this.auth.updateUserData(cleaned).subscribe({
      next: (error) => {
        this.loader.hide();
        if (error) {
          this.errorMessage.set(error);
        } else {
          const template = this.successToast();
          if (template) {
            this.toastService.show({
              template,
              classname: 'bg-success text-white',
              header: 'Zapisano!',
            });
          }
        }
      },
      error: (err) => {
        this.loader.hide();
        this.errorMessage.set('Wystąpił błąd podczas zapisu.');
        console.error(err);
      },
    });
  }
}
