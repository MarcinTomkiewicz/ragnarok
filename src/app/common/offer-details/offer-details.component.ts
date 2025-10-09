import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackendService } from '../../core/services/backend/backend.service';
import { CommonModule } from '@angular/common';
import { Offer } from '../../core/interfaces/i-offers';
import { CategoryService } from '../../core/services/category/category.service';
import { CategoryType } from '../../core/enums/categories';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-offer-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offer-details.component.html',
  styleUrl: './offer-details.component.scss',
})
export class OfferDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backendService = inject(BackendService);
  readonly categoryService = inject(CategoryService);
  private readonly platformService = inject(PlatformService);
  private readonly seo = inject(SeoService);

  readonly CategoryType = CategoryType;
  offer: Offer | null = null;
  loading = true;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.router.navigate(['/not-found']);
      return;
    }

    // Pobieramy po SLUG i włączamy przetwarzanie obrazka (ImageStorageService)
    this.backendService
      .getOneByFields<Offer>('offers', { slug }, /*width*/ undefined, /*height*/ undefined, /*processImages*/ true)
      .subscribe({
        next: (offer) => {
          this.offer = offer;
          this.loading = false;
          if (offer) this.seo.setTitleAndMeta(offer.title);
        },
        error: () => {
          this.offer = null;
          this.loading = false;
        },
      });
  }

  getCategoryName(id: number, categoryType: CategoryType): string {
    return this.categoryService.getCategoryName(id, categoryType);
  }

  buyNow(link: string | null | undefined) {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }

  isMobile(): boolean {
    return this.platformService.isBrowser && window.innerWidth < 810;
  }
}
