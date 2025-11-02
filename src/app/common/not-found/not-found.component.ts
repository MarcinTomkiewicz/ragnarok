import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { SeoService } from '../../core/services/seo/seo.service';
import { PlatformService } from '../../core/services/platform/platform.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly platform = inject(PlatformService);

  readonly ssrStatusMarker = '<!--SSR_STATUS:404-->';

  ngOnInit(): void {
    this.seo.setTitleAndMeta(
      'Strona nie znaleziona (404)',
      'Zgubiłeś się w labiryncie Ragnaröku. Wróć na główną stronę i odnajdź swoje przeznaczenie.'
    );

    if (this.platform.isBrowser) return;
  }
}
