import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  NgbAccordionModule,
  NgbDropdownModule,
  NgbModal,
  NgbPaginationModule,
  NgbTypeaheadModule,
} from '@ng-bootstrap/ng-bootstrap';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
  of,
  OperatorFunction,
  switchMap,
  tap,
  catchError,
  finalize,
  forkJoin,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CategoryListComponent } from '../../common/category-list/category-list/category-list.component';
import { InfoModalComponent } from '../../common/info-modal/info-modal.component';
import { LoaderComponent } from '../../common/loader/loader.component';

import { CategoryType } from '../../core/enums/categories';
import { FilterOperator } from '../../core/enums/filterOperator';
import { IconClass } from '../../core/enums/icons';
import { OfferSortField, SortOrder } from '../../core/enums/search';
import { IFilters } from '../../core/interfaces/i-filters';
import { Category, Offer, Subcategory } from '../../core/interfaces/i-offers';
import {
  BackendService,
  IPagination,
} from '../../core/services/backend/backend.service';
import { CategoryService } from '../../core/services/category/category.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { OffersService } from '../../core/services/offers/offers.service';

type OfferRow = Offer & {
  offersImages?: Array<{
    id: string;
    offerId: number;
    path: string;
    isPrimary: boolean;
    sortIndex: number | null;
    createdAt: string;
  }>;
  /** Precomputed, optimized image URL for card thumbnail */
  _imgUrl?: string;
};

@Component({
  selector: 'app-offers-list',
  standalone: true,
  imports: [
    CommonModule,
    NgbAccordionModule,
    NgbDropdownModule,
    RouterModule,
    CategoryListComponent,
    NgbPaginationModule,
    NgbTypeaheadModule,
    FormsModule,
    LoaderComponent,
  ],
  templateUrl: './offers-list.component.html',
  styleUrl: './offers-list.component.scss',
})
export class OffersListComponent implements OnInit {
  private readonly backendService = inject(BackendService);
  private readonly platformService = inject(PlatformService);
  private readonly modalService = inject(NgbModal);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly offersSvc = inject(OffersService);
  private readonly destroyRef = inject(DestroyRef);
  readonly categoryService = inject(CategoryService);

  readonly CategoryType = CategoryType;

  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  offersList: OfferRow[] = [];
  filteredOffers: OfferRow[] = [];
  private offersFetched = false;
  allOffers: OfferRow[] = [];

  currentSubcategoryId = signal<number | null>(null);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalOffers = signal<number>(0);

  /** Local overlay loader (also used during pagination/sort/filter). Starts true for SSR. */
  readonly isLoading = signal(true);

  offerLabels: Record<OfferSortField, string> = {
    [OfferSortField.ID]: 'Domyślnie',
    [OfferSortField.Title]: 'Tytuł',
    [OfferSortField.Price]: 'Cena',
    [OfferSortField.Stock]: 'Stan',
  };

  sortOrders = signal(
    new Map<OfferSortField, SortOrder>([
      [OfferSortField.Title, SortOrder.Asc],
      [OfferSortField.Price, SortOrder.Asc],
      [OfferSortField.Stock, SortOrder.Asc],
      [OfferSortField.ID, SortOrder.Asc],
    ])
  );

  readonly BRAND_NAME = 'Marka własna';
  brandCategoryId = signal<number | null>(null);

  currentSorting = signal<OfferSortField>(OfferSortField.ID);
  order = signal<SortOrder>(SortOrder.Asc);

  modalOpened = false;

  ngOnInit(): void {
    this.categoryService
      .loadCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, subcategories }) => {
          const brand = categories.find((c) => c.name === this.BRAND_NAME) ?? null;
          this.brandCategoryId.set(brand?.id ?? null);

          const brandId = this.brandCategoryId();
          this.categories = brandId == null ? categories : categories.filter((c) => c.id !== brandId);
          this.subcategories = brandId == null ? subcategories : subcategories.filter((sc) => sc.categoryId !== brandId);

          this.loadOffers();
        },
        error: (err) => console.error('Błąd podczas pobierania kategorii:', err),
      });

    this.seo.setTitleAndMeta('Sklep RPG');
  }

  openModal(): void {
    if (this.modalOpened) return;

    this.modalOpened = true;
    const modalRef = this.modalService.open(InfoModalComponent, {
      size: 'md',
      centered: true,
    });
    modalRef.componentInstance.header = 'Drodzy Wojownicy!';
    modalRef.componentInstance.message =
      'Tymczasowo oferta naszego sklepu jest dostępna tylko stacjonarnie w lokalu Ragnarok przy ul. Dolna Wilda 16A w Poznaniu.';
    modalRef.result.finally(() => {
      this.modalOpened = false;
    });
  }

  loadOffers(page: number = this.currentPage()): void {
    const subcategoryId = this.currentSubcategoryId();
    const brandId = this.brandCategoryId();

    const filters: IFilters = {};
    if (subcategoryId != null) filters['subcategoryId'] = { operator: FilterOperator.EQ, value: subcategoryId };
    if (brandId != null)       filters['categoryId']   = { operator: FilterOperator.NE, value: brandId };

    const pagination: IPagination = {
      page,
      pageSize: this.pageSize(),
      filters: Object.keys(filters).length ? filters : undefined,
    };

    const sortingField: OfferSortField = this.currentSorting();
    const sortingOrder = this.sortOrders().get(sortingField) ?? SortOrder.Asc;

    this.isLoading.set(true);

    this.backendService
      .getAll<OfferRow>('offers', sortingField, sortingOrder, pagination, undefined, 'offers_images(*)', true)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.error('Błąd podczas pobierania ofert:', err);
          return of<OfferRow[]>([]);
        }),
        switchMap((offers) => {
          // Precompute image URLs for current page
          const withUrls: OfferRow[] = offers.map((o) => ({
            ...o,
            _imgUrl: this.computeImageUrl(o),
          }));

          // Preload images (browser only). On SSR it's a no-op.
          const urls = withUrls.map((o) => o._imgUrl!).filter(Boolean);
          return this.preloadImages(urls).pipe(map(() => withUrls));
        }),
        finalize(() => {
          // Important: avoid turning off loader on SSR
          if (this.platformService.isBrowser) this.isLoading.set(false);
        })
      )
      .subscribe((withUrls) => {
        this.offersList = withUrls;
        this.filteredOffers = withUrls;
        this.updateTotalOffers(pagination.filters);
      });
  }

  updateTotalOffers(filters?: IFilters): void {
    this.backendService.getCount<Offer>('offers', filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalOffers.set(count),
        error: (err) => console.error('Błąd podczas liczenia ofert:', err),
      });
  }

  get sortFields(): OfferSortField[] {
    return Array.from(this.sortOrders().keys());
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadOffers(page);
  }

  onSubcategoryClick(subcategoryId: number | null): void {
    this.currentPage.set(1);
    this.currentSubcategoryId.set(subcategoryId);
    this.loadOffers();
  }

  getCategoryName(id: number, categoryType: CategoryType): string {
    return this.categoryService.getCategoryName(id, categoryType);
  }

  isMobile(): boolean {
    return this.platformService.isBrowser && window.innerWidth < 550;
  }

  buyNow(link: string | null | undefined, ev?: MouseEvent) {
    ev?.stopPropagation();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }

  sortBy(field: OfferSortField): void {
    const currentOrder = this.sortOrders().get(field);
    const newOrder = currentOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;

    this.sortOrders.update((orders) => {
      orders.set(field, newOrder);
      return new Map(orders);
    });

    this.currentSorting.set(field);
    this.loadOffers();
  }

  getSortIcon(field: OfferSortField): string {
    const order = this.sortOrders().get(field) ?? SortOrder.Asc;
    const isNumeric =
      field === OfferSortField.Price ||
      field === OfferSortField.Stock ||
      field === OfferSortField.ID;

    if (isNumeric) {
      return order === SortOrder.Asc ? IconClass.NumericAsc : IconClass.NumericDesc;
    }
    return order === SortOrder.Asc ? IconClass.AlphaAsc : IconClass.AlphaDesc;
  }

  // Typeahead (works independently of section overlay)
  search: OperatorFunction<string, OfferRow[]> = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.length < 3) return of([]);

        const brandId = this.brandCategoryId();
        const baseFilters: IFilters | undefined =
          brandId != null ? { categoryId: { operator: FilterOperator.NE, value: brandId } } : undefined;

        if (this.offersFetched) {
          return of(this.filterOffers(term));
        }

        return this.backendService
          .getAll<OfferRow>('offers', OfferSortField.Title, SortOrder.Asc, { filters: baseFilters }, undefined, 'offers_images(*)', true)
          .pipe(
            tap((offers) => {
              this.allOffers = offers.map((o) => ({ ...o, _imgUrl: this.computeImageUrl(o) }));
              this.offersFetched = true;
            }),
            map(() => this.filterOffers(term))
          );
      })
    );

  private filterOffers(term: string): OfferRow[] {
    return this.allOffers.filter((offer) => offer.title.toLowerCase().includes(term.toLowerCase()));
  }

  resultFormatter = (offer: OfferRow) => offer.title;
  inputFormatter = (offer: OfferRow) => (typeof offer === 'string' ? offer : offer.title);

  openDetails(offer: OfferRow) {
    this.router.navigate(['/offers', 'store', offer.slug]);
  }

  /** Build optimized public URL for a card */
  private computeImageUrl(offer: OfferRow): string {
    const imgs = offer.offersImages ?? [];
    let path: string | null = null;

    if (imgs.length) {
      const primary = imgs.find((x) => x.isPrimary) ?? null;
      path = (primary?.path ?? imgs[0]?.path) || null;
    }
    if (!path) path = offer.image || null;

    const url = this.offersSvc.publicUrl(path ?? '', 600, 450);
    return url ?? '';
  }

  /** Preload images; resolves after all load/error events fire. No-op on SSR. */
  private preloadImages(urls: string[]): Observable<void> {
    if (!this.platformService.isBrowser) return of(void 0);
    const unique = Array.from(new Set(urls.filter(Boolean)));
    if (!unique.length) return of(void 0);

    const loaders = unique.map(
      (src) =>
        new Observable<void>((observer) => {
          const img = new Image();
          img.onload = () => { observer.next(); observer.complete(); };
          img.onerror = () => { observer.next(); observer.complete(); };
          img.src = src;
        })
    );

    return forkJoin(loaders).pipe(map(() => void 0));
  }

  goToDetails(ev: MouseEvent, offer: OfferRow) {
    ev.stopPropagation();
    this.openDetails(offer);
  }

  onSelectOffer(event: any) {
    const selected: OfferRow = event.item;
    this.router.navigate(['/offers', 'store', selected.slug]);
  }
}
