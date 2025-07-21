import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { IOfferDetails } from '../../core/interfaces/i-offer-details';
import { PlatformService } from '../../core/services/platform/platform.service';
import { fromEvent } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-services-table',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './services-table.component.html',
  styleUrl: './services-table.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ServicesTableComponent {
  services = input<IOfferDetails[]>([]);
  isServiceByHour = input<boolean>(true);

  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);
  destroyRef?: DestroyRef;
  public isMobile = false;

  ngOnInit() {
    this.updateScreenState();
    if (this.platformService.isBrowser) {
      fromEvent(window, 'resize').subscribe(() => this.updateScreenState());
    }
  }

  updateScreenState() {
    this.isMobile = window.innerWidth < 600;
  }

  hasDetails(): boolean {
    return this.services().some((s) => s.details && s.detailsLink);
  }

    openDetails(link: string) {
    if (this.platformService.isBrowser) {
      this.router.navigate([link]);
    }
  }
}
