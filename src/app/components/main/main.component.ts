import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  AfterViewInit,
  Component,
  HostListener,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  NgbCarousel,
  NgbCarouselConfig,
  NgbCarouselModule,
} from '@ng-bootstrap/ng-bootstrap';

import { animate, style, transition, trigger } from '@angular/animations';
import { INews } from '../../core/interfaces/i-news';
import { BackendService } from '../../core/services/backend/backend.service';
import { ConverterService } from '../../core/services/converter/converter.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { Router } from '@angular/router';
import { NewsCarouselComponent } from '../../common/news-carousel/news-carousel.component';
import { AudienceSectionComponent } from '../audience-section/audience-section.component';
import { HowItWorksComponent } from '../how-it-works/how-it-works.component';
import { UpcomingEventsComponent } from '../upcoming-events/upcoming-events.component';
import { MeetTheTeamComponent } from '../meet-the-team/meet-the-team.component';
import { TestimonialComponent } from '../testimonial/testimonial.component';
import { HighlightComponent } from '../../common/highlight/highlight.component';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    CommonModule,
    NgbCarouselModule,
    AudienceSectionComponent,
    HowItWorksComponent,
    UpcomingEventsComponent,
    MeetTheTeamComponent,
    TestimonialComponent,
    HighlightComponent,
  ],
  providers: [NgbCarouselConfig],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit, AfterViewInit {
  @ViewChild('carousel', { static: false }) carousel: NgbCarousel | undefined;
  isLoading = signal(true);
  isMobile = signal(false);
  newsItems: INews[] = [];
  private touchStartX = 0;
  private touchEndX = 0;

  private readonly router = inject(Router);
  private readonly backend = inject(BackendService);
  private readonly converter = inject(ConverterService);
  private readonly platformService = inject(PlatformService);

  highlightData = {
    heading: 'Dołącz do Klubu Gier Fabularnych w Ragnaroku',
    text: 'Poznaj świat RPG z Członkostwem Klubu Gier Fabularnych Ragnaroku lub zdobądź Złoty Bilet do Valhalli – zawierający nielimitowane granie, dostęp do salki VIP i zniżek. Darmowe rezerwacje, rabaty, napoje, MG na życzenie i dostęp do klubowej społeczności. Dla tych, którzy chcą grać częściej, lepiej i taniej.',
    link: '/memberships',
    linkText: 'Poznaj korzyści członkostwa',
    icon: 'bi bi-shield-check',
  };

  ngOnInit() {
    const win = this.platformService.getWindow();
    
    if (win) {
      this.isMobile.set(win.innerWidth <= 768);
    }
  }

  ngAfterViewInit() {
    this.platformService.listenToWindowEvent(
      'resize',
      this.onResize.bind(this)
    );
  }

  addResizeListener() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    const win = this.platformService.getWindow();
    if (win) {
      this.isMobile.set(win.innerWidth <= 768);
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipeGesture();
  }

  handleSwipeGesture() {
    const swipeDistance = this.touchStartX - this.touchEndX;
    const carouselInstance = this.carousel;
    if (!carouselInstance) return;

    if (swipeDistance > 50) carouselInstance.next();
    if (swipeDistance < -50) carouselInstance.prev();
  }

  navigate(link: string) {
    if (!this.platformService.isBrowser) return;

    if (this.isExternalLink(link)) {
      this.platformService.openNewTab(link);
    } else {
      this.router.navigateByUrl(link);
    }
  }

  isExternalLink(url: string): boolean {
    const loc = this.platformService.getLocation();
    if (!loc) return false;

    try {
      const linkUrl = new URL(url, loc.href);
      return linkUrl.hostname !== loc.hostname;
    } catch {
      return false;
    }
  }
}
