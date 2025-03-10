import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-wrapper',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet> `,
  styleUrl: './admin-wrapper.component.scss',
})
export class AdminWrapperComponent {}
