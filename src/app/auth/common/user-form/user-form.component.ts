import { Component, Input, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
})
export class UserFormComponent implements OnInit {
  readonly form = input.required<FormGroup>();
  readonly showEmail = input(false);
  readonly showPassword = input(false);
  readonly disabledEmail = input(false);

  ngOnInit(): void {
    if (this.disabledEmail()) {
      this.form().get('email')?.disable();
    }
  }
}
