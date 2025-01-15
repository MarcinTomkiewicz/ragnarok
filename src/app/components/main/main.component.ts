import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, input, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  @Input() navigateToServices!: () => void;
  // navigateToServices = input<() => void>();
  router = inject(Router);
  el = inject(ElementRef)
}
