import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  NgbAccordionModule,
  NgbDropdownModule,
  NgbPaginationModule,
  NgbTypeaheadModule,
} from '@ng-bootstrap/ng-bootstrap';
import {
  Observable,
  of,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  map,
  tap,
  OperatorFunction,
} from 'rxjs';

import {
  BackendService,
  IPagination
} from '../../core/services/backend/backend.service';
import { FilterOperator } from '../../core/enums/filterOperator';
import { OfferSortField, SortOrder } from '../../core/enums/search';
import { IconClass } from '../../core/enums/icons';
import { Category, Subcategory, Offer } from '../../core/interfaces/i-offers';
import { CategoryType } from '../../core/enums/categories';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { CategoryListComponent } from '../../common/category-list/category-list/category-list.component';

@Component({
  selector: 'app-brand-offers',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    NgbAccordionModule,
    NgbDropdownModule,
    NgbPaginationModule,
    NgbTypeaheadModule,
    CategoryListComponent
  ],
  templateUrl: './brand-offers.component.html',
  styleUrl: './brand-offers.component.scss',
})
export class BrandOffersComponent implements OnInit {
  private readonly backend = inject(BackendService);
  private readonly platform = inject(PlatformService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  // Konfiguracja – łatwo zmienialna:
  readonly brandCategoryName = signal<string>('Marka własna');

  // Dane
  brandCategory = signal<Category | null>(null);
  subcategories = signal<Subcategory[]>([]);
  // pojedyncza kategoria jako tablica dla app-category-list:
  brandCategories = computed<Category[]>(() => {
    const c = this.brandCategory();
    return c ? [c] : [];
  });
  offers = signal<Offer[]>([]);
  totalOffers = signal<number>(0);

  // UI stan
  currentSubcategoryId = signal<number | null>(null);
  currentPage = signal<number>(1);
  pageSize = signal<number>(12);

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

  currentSorting = signal<OfferSortField>(OfferSortField.ID);

  // Wyszukiwarka – cache lokalny dla brandu
  private allBrandOffers: Offer[] = [];
  private offersPrefetched = false;

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Sklep RPG | Ragnarok – Marka własna');

    // 1) Pobierz kategorię po nazwie
    this.backend
      .getOneByFields<Category>('categories', {
        name: this.brandCategoryName(),
      })
      .subscribe({
        next: (cat) => {
          this.brandCategory.set(cat);
          if (!cat) return;

          // 2) Subkategorie tylko dla tej kategorii
          this.backend
            .getAll<Subcategory>('subcategories', 'name', 'asc', {
              filters: {
                categoryId: { operator: FilterOperator.EQ, value: cat.id },
              },
            })
            .subscribe({
              next: (subs) => {
                // sort: „Inne” na koniec – jak w CategoryService
                const sorted = [...subs].sort((a, b) => {
                  const ai = a.name.toLowerCase() === 'inne';
                  const bi = b.name.toLowerCase() === 'inne';
                  if (ai && !bi) return 1;
                  if (!ai && bi) return -1;
                  return a.name.localeCompare(b.name);
                });
                this.subcategories.set(sorted);
                // 3) Pierwsze pobranie ofert
                this.loadOffers();
              },
              error: (err) =>
                console.error('Błąd pobierania subkategorii brandu:', err),
            });
        },
        error: (err) =>
          console.error('Błąd pobierania kategorii „Marka własna”:', err),
      });
  }

  private buildFilters(): Record<string, any> {
    const catId = this.brandCategory()?.id ?? null;
    const subId = this.currentSubcategoryId();
    const filters: Record<string, any> = {
      isActive: { operator: FilterOperator.EQ, value: true },
    };
    if (catId != null) {
      filters['categoryId'] = { operator: FilterOperator.EQ, value: catId };
    }
    if (subId != null) {
      filters['subcategoryId'] = { operator: FilterOperator.EQ, value: subId };
    }
    return filters;
  }

  loadOffers(page: number = this.currentPage()): void {
    const sortingField = this.currentSorting();
    const order = this.sortOrders().get(sortingField) ?? SortOrder.Asc;

    const pagination: IPagination = {
      page,
      pageSize: this.pageSize(),
      filters: this.buildFilters(),
    };

    this.backend
      .getAll<Offer>('offers', sortingField, order, pagination)
      .subscribe({
        next: (list) => {
          this.offers.set(list);
          // liczba łączna z tymi samymi filtrami (bez paginacji)
          this.backend.getCount<Offer>('offers', pagination.filters).subscribe({
            next: (count) => this.totalOffers.set(count),
            error: (err) => console.error('Błąd liczenia ofert brandu:', err),
          });
        },
        error: (err) => console.error('Błąd pobierania ofert brandu:', err),
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadOffers(page);
  }

  onSubcategoryClick(subId: number | null): void {
    this.currentPage.set(1);
    this.currentSubcategoryId.set(subId);
    this.loadOffers();
  }

  sortFields(): OfferSortField[] {
    return Array.from(this.sortOrders().keys());
  }

  sortBy(field: OfferSortField): void {
    const curr = this.sortOrders().get(field);
    const next = curr === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
    this.sortOrders.update((m) => {
      m.set(field, next);
      return new Map(m);
    });
    this.currentSorting.set(field);
    this.loadOffers();
  }

  getSortIcon(field: OfferSortField): string {
    const order = this.sortOrders().get(field) ?? SortOrder.Asc;
    const isNum =
      field === OfferSortField.Price ||
      field === OfferSortField.Stock ||
      field === OfferSortField.ID;
    if (isNum)
      return order === SortOrder.Asc
        ? IconClass.NumericAsc
        : IconClass.NumericDesc;
    return order === SortOrder.Asc ? IconClass.AlphaAsc : IconClass.AlphaDesc;
  }

  isMobile(): boolean {
    return this.platform.isBrowser && window.innerWidth < 550;
  }

  buyNow(link: string | null | undefined): void {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }

  // Typeahead ograniczony do ofert brandu
  search: OperatorFunction<string, Offer[]> = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.length < 3) return of([]);
        if (this.offersPrefetched) {
          return of(this.filterOffers(term));
        }
        const filters = this.buildFilters();
        // pobierz bez paginacji, sort po tytule
        return this.backend
          .getAll<Offer>('offers', OfferSortField.Title, SortOrder.Asc, {
            filters,
          })
          .pipe(
            tap((offers) => {
              this.allBrandOffers = offers;
              this.offersPrefetched = true;
            }),
            map(() => this.filterOffers(term))
          );
      })
    );

  private filterOffers(term: string): Offer[] {
    const q = term.toLowerCase();
    return this.allBrandOffers.filter((o) => o.title.toLowerCase().includes(q));
  }

  // dropdown formatery
  resultFormatter = (offer: Offer) => offer.title;
  inputFormatter = (offer: Offer | string) =>
    typeof offer === 'string' ? offer : offer.title;

  // NAWIGACJA PO SLUG
  onSelectOffer(event: any): void {
    const selected: Offer = event.item;
    this.router.navigate(['/offers', 'store', selected.slug]);
  }

  get CategoryType() {
    return CategoryType;
  }
}
