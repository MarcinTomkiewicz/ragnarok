import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase/supabase.service';

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
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  constructor(
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async login() {
    this.errorMessage = null;
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;

    const { error } = await this.supabaseService
      .getClient()
      .auth.signInWithPassword({ email, password });

    if (error) {
      this.errorMessage = error.message;
    } else {
      this.router.navigate(['/']);
    }
  }
}
