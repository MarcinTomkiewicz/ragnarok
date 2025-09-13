import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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
} from 'rxjs';
import { CategoryListComponent } from '../../common/category-list/category-list/category-list.component';
import { InfoModalComponent } from '../../common/info-modal/info-modal.component';
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
  ],
  templateUrl: './offers-list.component.html',
  styleUrl: './offers-list.component.scss',
})
export class OffersListComponent implements OnInit {
  private readonly backendService = inject(BackendService);
  private readonly platformService = inject(PlatformService);
  private readonly modalService = inject(NgbModal);
  private readonly router = inject(Router);
  readonly categoryService = inject(CategoryService);
  private readonly seo = inject(SeoService);
  readonly CategoryType = CategoryType;

  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  offersList: Offer[] = [];
  filteredOffers: Offer[] = [];
  private offersFetched = false;
  allOffers: Offer[] = [];

  currentSubcategoryId = signal<number | null>(null);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalOffers = signal<number>(0);

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
  order = signal<SortOrder>(SortOrder.Asc);

  modalOpened = false;

  ngOnInit(): void {
    this.categoryService.loadCategories().subscribe({
      next: ({ categories, subcategories }) => {
        this.categories = categories;
        this.subcategories = subcategories;
        this.loadOffers();
      },
      error: (err) => console.error('Błąd podczas pobierania kategorii:', err),
    });
    this.seo.setTitleAndMeta('Produkty');
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
    const pagination: IPagination = {
      page: page,
      pageSize: this.pageSize(),
      filters: subcategoryId
        ? {
            subcategoryId: {
              operator: FilterOperator.EQ,
              value: subcategoryId,
            },
          }
        : undefined,
    };

    const sortingField: OfferSortField = this.currentSorting();
    const sortingOrder = this.sortOrders().get(sortingField) ?? SortOrder.Asc;

    this.backendService
      .getAll<Offer>('offers', sortingField, sortingOrder, pagination)
      .subscribe({
        next: (offers) => {
          this.offersList = offers;
          this.filteredOffers = offers;
          this.updateTotalOffers(pagination.filters);
        },
        error: (err) => console.error('Błąd podczas pobierania ofert:', err),
      });
  }

  updateTotalOffers(filters?: IFilters): void {
    this.backendService.getCount<Offer>('offers', filters).subscribe({
      next: (count) => {
        this.totalOffers.set(count);
      },
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

  buyNow(link: string) {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }

  sortBy(field: OfferSortField): void {
    const currentOrder = this.sortOrders().get(field);
    const newOrder =
      currentOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;

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
      return order === SortOrder.Asc
        ? IconClass.NumericAsc
        : IconClass.NumericDesc;
    }
    return order === SortOrder.Asc ? IconClass.AlphaAsc : IconClass.AlphaDesc;
  }

  search: OperatorFunction<string, Offer[]> = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.length < 3) return of([]);

        if (this.offersFetched) {
          return of(this.filterOffers(term));
        }

        return this.backendService
          .getAll<Offer>('offers', OfferSortField.Title, SortOrder.Asc)
          .pipe(
            tap((offers) => {
              this.allOffers = offers;
              this.offersFetched = true;
            }),
            map(() => this.filterOffers(term))
          );
      })
    );

  private filterOffers(term: string): Offer[] {
    return this.allOffers.filter((offer) =>
      offer.title.toLowerCase().includes(term.toLowerCase())
    );
  }

  // formatowanie w dropdownie
  resultFormatter = (offer: Offer) => offer.title;
  inputFormatter = (offer: Offer) =>
    typeof offer === 'string' ? offer : offer.title;

  // akcja po kliknięciu
  onSelectOffer(event: any): void {
    const selectedOffer: Offer = event.item;
    this.router.navigate(['/offer', selectedOffer.id]);
  }
}
