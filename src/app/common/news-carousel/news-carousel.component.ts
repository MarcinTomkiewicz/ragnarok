import { CommonModule } from '@angular/common';
import { Component, Signal, input, ViewChild, inject, computed } from '@angular/core';
import { NgbCarousel, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { INews } from '../../core/interfaces/i-news';
import { PlatformService } from '../../core/services/platform/platform.service';
import { Router } from '@angular/router';
import { BackendService } from '../../core/services/backend/backend.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-news-carousel',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule],
  templateUrl: './news-carousel.component.html',
  styleUrl: './news-carousel.component.scss',
})
export class NewsCarouselComponent {
  newsItems = input.required<INews[]>();
  isMobile = input.required<Signal<boolean>>();
  interval = input(5000);

    private readonly platformService = inject(PlatformService);
    private readonly router = inject(Router);
    private readonly backendService = inject(BackendService)
    
  @ViewChild(NgbCarousel, { static: true }) carousel?: NgbCarousel;

  navigate(link: string) {
    if (!this.platformService.isBrowser) return;

    if (this.isExternalLink(link)) {
      window.open(link, '_blank');
    } else {
      this.router.navigateByUrl(link); // Zamiast window.location.href
    }
  }


  private authorCache = new Map<string, Observable<any>>();

  getAuthor(authorId: string): Observable<any> {
    if (!this.authorCache.has(authorId)) {
      const obs$ = this.backendService.getById('users', authorId).pipe(
      );
      this.authorCache.set(authorId, obs$);
    }
    return this.authorCache.get(authorId)!;
  }

  log(data:any): void {
    console.log(data);
    
  }

  isExternalLink(url: string): boolean {
    try {
      const link = new URL(url, window.location.href);
      return link.hostname !== window.location.hostname;
    } catch (e) {
      return false;
    }
  }
}
