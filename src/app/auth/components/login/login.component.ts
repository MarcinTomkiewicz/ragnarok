import { Component, inject, TemplateRef, viewChild } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  FormGroup,
  Validators,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase/supabase.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoaderService } from '../../../core/services/loader/loader.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { Responses } from '../../../core/enums/responses';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly loaderService = inject(LoaderService);
  private readonly toastService = inject(ToastService);
  readonly successToast = viewChild<TemplateRef<unknown>>('loginSuccessToast');

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  login() {
    this.loaderService.show();
    this.authService
      .login(this.loginForm.value.email, this.loginForm.value.password)
      .subscribe({
        next: (response) => {
          if (response === Responses.Success) {
            this.loaderService.hide();
            const template = this.successToast();
            if (template) {
              this.toastService.show({
                template,
                classname: 'bg-success text-white',
                header: 'Zalogowano!',
              });
            }
            this.router.navigate(['/']);
          }
        },
      });
  }
}
