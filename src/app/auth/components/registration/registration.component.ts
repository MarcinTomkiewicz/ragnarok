import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  TemplateRef,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IUser } from '../../../core/interfaces/i-user';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoaderService } from '../../../core/services/loader/loader.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { sanitizeUserData } from '../../../core/utils/sanitize-user';
import { UserFormComponent } from '../../common/user-form/user-form.component';
import { createUserForm } from '../../core/factories/user-form.factory';

@Component({
  selector: 'app-registration',
  standalone: true,
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule, UserFormComponent],
})
export class RegistrationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly loaderService = inject(LoaderService);
  private readonly toastService = inject(ToastService);

  readonly successToast = viewChild<TemplateRef<unknown>>('registrationSuccessToast');

  readonly registerForm = createUserForm(this.fb, true, true);

  errorMessage: string | null = null;

  register(): void {
    if (this.registerForm.invalid) return;

    this.loaderService.show();

    const { email, password, ...rest } = this.registerForm.value;

    const rawUser: Partial<IUser> = {
      email: email!,
      role: 'user',
      coworker: 'user',
      ...rest,
    };

    const sanitizedUser = sanitizeUserData(rawUser);

    this.authService.register(email!, password!, sanitizedUser).subscribe({
      next: (error) => {
        this.loaderService.hide();
        if (error) {
          this.errorMessage = error;
          return;
        }

        const template = this.successToast();
        if (template) {
          this.toastService.show({
            template,
            classname: 'bg-success text-white',
            header: 'Zarejestrowano!',
          });
        }

        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loaderService.hide();
        this.errorMessage = 'Wystąpił błąd rejestracji.';
        console.error(err);
      },
    });
  }
}
