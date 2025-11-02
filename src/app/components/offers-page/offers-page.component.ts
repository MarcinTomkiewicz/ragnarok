import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { map, switchMap, distinctUntilChanged, tap, finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { ServicesTableComponent } from '../../common/services-table/services-table.component';
import { LoaderComponent } from '../../common/loader/loader.component';

import { IOfferCategory } from '../../core/interfaces/i-offer-category';
import { SeoService } from '../../core/services/seo/seo.service';
import { RegulationsComponent } from '../regulations/regulations.component';
import { ViewResolverService } from '../../core/services/backend/view-resolver/view-resolver.service';

@Component({
  selector: 'app-offers-page',
  standalone: true,
  imports: [ServicesTableComponent, LoaderComponent],
  templateUrl: './offers-page.component.html',
  styleUrl: './offers-page.component.scss',
})
export class OffersPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly resolver = inject(ViewResolverService);
  private readonly modal = inject(NgbModal);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  offerCategory?: IOfferCategory;
  readonly loading = signal(true);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(params => params.get('slug')),
        distinctUntilChanged(),
        switchMap(slug => {
          if (!slug) {
            // brak sluga — nic do pobrania, wyłącz loader i wyczyść dane
            this.offerCategory = undefined;
            this.loading.set(false);
            return of<IOfferCategory | null>(null);
          }

          // start requestu
          this.loading.set(true);
          return this.resolver
            .resolveBySlug<IOfferCategory>('offer_pages', slug)
            .pipe(
              catchError(() => of(null)),
              finalize(() => this.loading.set(false))
            );
        })
      )
      .subscribe(data => {
        this.offerCategory = data ?? undefined;
        if (data) this.seo.setTitleAndMeta(data.title, data.subtitle || '');
      });
  }

  openRules(type: 'rent' | 'pass') {
    const modalRef = this.modal.open(RegulationsComponent, { size: 'lg' });
    modalRef.componentInstance.type = type;
  }
}
