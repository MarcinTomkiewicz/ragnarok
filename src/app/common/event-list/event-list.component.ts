import { Component, input, inject, DestroyRef } from '@angular/core';
import { EventData } from '../../core/interfaces/i-event';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PlatformService } from '../../core/services/platform/platform.service';
import { fromEvent, takeUntil } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss',
})
export class EventListComponent {
  events = input<EventData[]>([]);
  recurring = input<boolean>(false);

  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);
  destroyRef?: DestroyRef;
  public isMobile = false;

  ngOnInit() {
    this.updateScreenState();
    if (this.platformService.isBrowser) {
      fromEvent(window, 'resize')
        .subscribe(() => this.updateScreenState());
    }
  }

  updateScreenState() {
    this.isMobile = window.innerWidth < 600;    
  }

  openFacebook(link: string) {
    if (this.platformService.isBrowser) {
      window.open(link, '_blank', 'noopener');
    }
  }

  openEventDetails(eventId: number) {
    if (this.platformService.isBrowser) {
      this.router.navigate(['/event', eventId]);
    }
  }

  checkScreenWidth(minWidth: number = 370): boolean {
    return this.platformService.isBrowser && window.innerWidth >= minWidth;
  }
}
