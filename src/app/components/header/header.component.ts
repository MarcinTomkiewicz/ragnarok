import { NgOptimizedImage } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  title = signal('Gdzie legendy pisze się kostkami');
  subtitle = signal('Nie wiesz co przyniesie los, ale to Ty zadecydujesz');
  ctaText = signal('Rozpocznij przygodę');
}
