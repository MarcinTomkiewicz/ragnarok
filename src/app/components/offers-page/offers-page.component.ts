import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ServicesTableComponent } from '../../common/services-table/services-table.component';
import { IOfferCategory } from '../../core/interfaces/i-offer-category';
import { BackendService } from '../../core/services/backend/backend.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { RegulationsComponent } from '../regulations/regulations.component';

@Component({
  selector: 'app-offers-page',
  standalone: true,
  imports: [ServicesTableComponent],
  templateUrl: './offers-page.component.html',
  styleUrl: './offers-page.component.scss',
})
export class OffersPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(BackendService);
  private readonly modal = inject(NgbModal);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  offerCategory?: IOfferCategory;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) return;

      this.backend
        .getBySlug<IOfferCategory>('offer_pages', slug)
        .subscribe((data) => {
          if (!data) return;
          this.offerCategory = data;
          this.seo.setTitleAndMeta(data.title, data.subtitle || '');
        });
    });
  }

  openRules(type: 'rent' | 'pass') {
    const modalRef = this.modal.open(RegulationsComponent, {
      size: 'lg',
    });
    modalRef.componentInstance.type = type;
  }
}
