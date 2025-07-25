import { CommonModule } from '@angular/common';
import { Component, OnInit, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
})
export class UserFormComponent {
  readonly form = input.required<FormGroup>();
  readonly showEmail = input(false);
  readonly showPassword = input(false);
  readonly disabledEmail = input(false);
}
