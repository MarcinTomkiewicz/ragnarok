import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { SeoService } from '../../core/services/seo/seo.service';
import { PlatformService } from '../../core/services/platform/platform.service';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './not-authorized.component.html',
  styleUrl: './not-authorized.component.scss',
})
export class NotAuthorizedComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly platform = inject(PlatformService);

  readonly ssrStatusMarker = '<!--SSR_STATUS:403-->';

  ngOnInit(): void {
    this.seo.setTitleAndMeta(
      'Brak dostępu (403)',
      'Nie masz uprawnień do wyświetlenia tej strony. Jeśli to błąd, skontaktuj się z Ragnarok – Centrum Gier Fabularnych.'
    );

    if (this.platform.isBrowser) return;
  }
}
