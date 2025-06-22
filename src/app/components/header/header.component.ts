import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  title = signal('Gdzie legendy pisze się kostkami');
  subtitle = signal('Twoja przygoda zaczyna się tutaj!');
  ctaText = signal('Złoty Bilet do Valhalli!');
}
