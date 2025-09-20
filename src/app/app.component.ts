import { Component, DestroyRef, effect, inject } from '@angular/core';
import {
  Router,
  RouterOutlet,
  ActivatedRoute,
  NavigationEnd,
} from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TrackingService } from './core/services/tracking/tracking.service';
import { SeoService } from './core/services/seo/seo.service';
import { PlatformService } from './core/services/platform/platform.service';
import { ENV_GTM_ID } from './core/tokens';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastContainerComponent } from './common/toast-container/toast-container.component';
import { LoaderComponent } from './common/loader/loader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    HeaderComponent,
    FooterComponent,
    ToastContainerComponent,
    LoaderComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly rootRoute = inject(ActivatedRoute);
  private readonly tracking = inject(TrackingService);
  private readonly seo = inject(SeoService);
  private readonly platform = inject(PlatformService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly GTM_ID = inject(ENV_GTM_ID);

  constructor() {
    this.tracking.initGtm(this.GTM_ID);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(() => this.deepestChild(this.rootRoute)),
        map((route) => ({
          title: route?.snapshot.data?.['title'] as string | undefined,
          description: route?.snapshot.data?.['description'] as
            | string
            | undefined,
          image: route?.snapshot.data?.['image'] as string | undefined,
          url: this.router.url,
        })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ title, description, image, url }) => {
        const pageTitle = title ?? this.titleFromUrl(url);
        this.seo.setTitleAndMeta(pageTitle, description, image);

        if (this.platform.isBrowser) {
          this.tracking.whenReady(() => {
            this.tracking.pushEvent('page_view', {
              page_path: url,
              page_location: location.href,
              page_title: document.title,
            });
          });
        }
      });

       this.router.events
    .pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe((e) => {
      if (!this.platform.isBrowser) return;

      const url = e.urlAfterRedirects || e.url;
      const cleanPath = url.split('?')[0].split('#')[0];

      if (cleanPath === '/') return;

      requestAnimationFrame(() => {
        const target = document.getElementById('router-outlet');
        const nav = document.querySelector('.nav-bar') as HTMLElement | null;
        const offset = nav?.getBoundingClientRect().height ?? 0;

        const top = target
          ? target.getBoundingClientRect().top + window.scrollY - offset
          : 0;

        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  private deepestChild(route: ActivatedRoute): ActivatedRoute | null {
    let r: ActivatedRoute | null = route;
    while (r?.firstChild) r = r.firstChild;
    return r;
  }

  private titleFromUrl(url: string): string {
    if (!url || url === '/') return 'Strona główna';
    const last = url
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean)
      .pop()!;
    return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }
}
