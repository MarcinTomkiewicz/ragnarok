import {
  Component,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CategoryType } from '../../core/enums/categories';
import { CategoryService } from '../../core/services/category/category.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { OffersService } from '../../core/services/offers/offers.service';
import { Offer, OfferImage } from '../../core/interfaces/i-offers';
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-offer-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offer-details.component.html',
  styleUrl: './offer-details.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class OfferDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offers = inject(OffersService);
  readonly categoryService = inject(CategoryService);
  private readonly platform = inject(PlatformService);
  private readonly seo = inject(SeoService);

  readonly CategoryType = CategoryType;
  offer: Offer | null = null;
  loading = true;

  /** URL-e do galerii: primary najpierw, potem reszta; fallback na legacy image */
  galleryUrls: string[] = [];

  ngOnInit(): void {
    if (this.platform.isBrowser) register();

    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.router.navigate(['/not-found']);
      return;
    }

    this.categoryService.loadCategories().subscribe({
      error: (e) => console.warn('Nie udało się wczytać kategorii:', e),
    });

    // Pobieramy ofertę + dołączone offers_images
    this.offers.getBySlug(slug, /*processImages*/ true).subscribe({
      next: (offer) => {
        this.offer = offer;
        this.loading = false;
        if (offer) {
          this.seo.setTitleAndMeta(`Sklep RPG | ${offer.title}`);
          this.buildGallery(offer);
        }
      },
      error: () => {
        this.offer = null;
        this.loading = false;
      },
    });
  }

  private buildGallery(o: Offer) {
    const images = ((o as any).images as OfferImage[] | undefined) ?? [];
    if (images.length) {
      const sorted = images.slice().sort((a, b) => {
        // primary najpierw, potem po sortIndex
        const byPrim = Number(b.isPrimary) - Number(a.isPrimary);
        if (byPrim !== 0) return byPrim;
        return (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
      });
      this.galleryUrls = sorted
        .map((img) => this.offers.publicUrl(img.path, 1600, 1200) ?? '')
        .filter(Boolean);
      return;
    }

    // Fallback: legacy miniatura
    const legacy = this.offers.publicUrl(o.image ?? '', 1600, 1200);
    this.galleryUrls = legacy ? [legacy] : [];
  }

  getCategoryName(id: number, categoryType: CategoryType): string {
    return this.categoryService.getCategoryName(id, categoryType);
  }

  buyNow(link: string | null | undefined) {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }

  isMobile(): boolean {
    return this.platform.isBrowser && window.innerWidth < 810;
  }
}
