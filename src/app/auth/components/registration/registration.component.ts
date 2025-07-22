import {
  Component,
  inject,
  TemplateRef,
  viewChild,
  effect,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoaderService } from '../../../core/services/loader/loader.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { Responses } from '../../../core/enums/responses';
import { createUserForm } from '../../factories/user-form.factory';
import { UserFormComponent } from '../../common/user-form/user-form.component';


@Component({
  selector: 'app-registration',
  standalone: true,
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule, UserFormComponent],
})
export class RegistrationComponent {
  readonly fb = inject(FormBuilder);
  readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly loaderService = inject(LoaderService);
  readonly toastService = inject(ToastService);

  readonly successToast = viewChild<TemplateRef<unknown>>(
    'registrationSuccessToast'
  );
  readonly userForm = createUserForm(this.fb);

  readonly registerForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    firstName: [''],
    phoneNumber: [''],
    city: [''],
    street: [''],
    houseNumber: [''],
    apartmentNumber: [''],
    postalCode: [''],
    age: [null],
    shortDescription: [''],
    longDescription: [''],
    extendedDescription: [''],
  });

  errorMessage: string | null = null;

  register(): void {
    this.loaderService.show();
    const { email, password, ...rest } = this.registerForm.value;

    this.authService.register(rest.firstName || email!, password!)
      .subscribe({
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
