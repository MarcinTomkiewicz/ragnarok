import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BackendService } from '../../core/services/backend/backend.service';
import { CommonModule } from '@angular/common';
import { Offer } from '../../core/interfaces/i-offers';
import { CategoryService } from '../../core/services/category/category.service';
import { CategoryType } from '../../core/enums/categories';
import { PlatformService } from '../../core/services/platform/platform.service';

@Component({
  selector: 'app-offer-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offer-details.component.html',
  styleUrl: './offer-details.component.scss',
})
export class OfferDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly backendService = inject(BackendService);
  readonly categoryService = inject(CategoryService);
  private readonly platformService = inject(PlatformService);

  readonly CategoryType = CategoryType;
  offer: Offer | null = null;

  ngOnInit(): void {
    const offerId = Number(this.route.snapshot.paramMap.get('id'));
    if (offerId) {
      this.backendService.getById<Offer>('offers', offerId).subscribe({
        next: (offer) => {
          this.offer = offer;
          console.log('Szczegóły oferty:', offer);
        },
        error: (err) => console.error('Błąd podczas pobierania oferty:', err),
      });
    }
  }

  getCategoryName(id: number, categoryType: CategoryType): string {
    return this.categoryService.getCategoryName(id, categoryType);
  }

  buyNow(link: string) {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }

  isMobile(): boolean {
    return this.platformService.isBrowser && window.innerWidth < 810;
  }

}
