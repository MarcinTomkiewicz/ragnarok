import { Component, inject } from '@angular/core';
import { SeoService } from '../../core/services/seo/seo.service';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.setTitleAndMeta(
      'Strona nie znaleziona (404)',
      'Zgubiłeś się w labiryncie Ragnaröku. Wróć na główną stronę i odnajdź swoje przeznaczenie.',
      // '/assets/images/404-dragon.png'
    );
  }
}
