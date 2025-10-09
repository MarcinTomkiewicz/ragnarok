import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  map,
  tap,
} from 'rxjs';

import {
  BackendService,
  IPagination,
} from '../../../core/services/backend/backend.service';
import { CategoryService } from '../../../core/services/category/category.service';
import { IconClass } from '../../../core/enums/icons';
import {
  Category,
  Subcategory,
  Offer,
} from '../../../core/interfaces/i-offers';
import { RouterLink } from '@angular/router';

type OfferAdminSortField =
  | 'title'
  | 'price'
  | 'stock'
  | 'createdAt'
  | 'category'
  | 'subcategory';

const SERVER_COLUMN: Record<
  Exclude<OfferAdminSortField, 'category' | 'subcategory'>,
  keyof Offer
> = {
  title: 'title',
  price: 'price',
  stock: 'stock',
  createdAt: 'createdAt',
};

@Component({
  selector: 'app-offers-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPaginationModule, RouterLink],
  templateUrl: './offers-admin.component.html',
  styleUrls: ['./offers-admin.component.scss'],
})
export class OffersAdminComponent implements OnInit {
  private readonly backend = inject(BackendService);
  private readonly categoriesSvc = inject(CategoryService);

  // referencje kategorii/subkategorii (wyświetlanie + sort client)
  private categories = signal<Category[]>([]);
  private subcategories = signal<Subcategory[]>([]);

  // stan tabeli
  readonly pageSizeOptions = [10, 50, 100];
  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);
  readonly totalOffers = signal<number>(0);

  readonly sortLabels: Record<OfferAdminSortField, string> = {
    title: 'Nazwa',
    price: 'Cena',
    stock: 'Stan',
    createdAt: 'Dodano',
    category: 'Kategoria',
    subcategory: 'Subkategoria',
  };
  readonly sortFields: OfferAdminSortField[] = [
    'title',
    'price',
    'stock',
    'createdAt',
    'category',
    'subcategory',
  ];
  readonly sortField = signal<OfferAdminSortField>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  // strona z serwera
  private pageOffers = signal<Offer[]>([]);

  // cache do wyszukiwarki (prefetch all raz)
  private allFetched = signal<boolean>(false);
  private allOffers = signal<Offer[]>([]);
  private readonly searchInput$ = new Subject<string>();
  readonly query = signal<string>('');
  readonly isSearchActive = computed(() => this.query().trim().length >= 3);

  // wynik do wyświetlenia
  readonly pagedOffers = computed(() => {
    if (this.isSearchActive()) {
      const start = (this.currentPage() - 1) * this.pageSize();
      return this.filteredOffers().slice(start, start + this.pageSize());
    }
    return this.sortedPageOffers();
  });

  get currentPageRef(): number {
    return this.currentPage();
  }
  set currentPageRef(v: number) {
    this.currentPage.set(v);
  }

  ngOnInit(): void {
    // dane referencyjne
    this.categoriesSvc.loadCategories().subscribe({
      next: ({ categories, subcategories }) => {
        this.categories.set(categories);
        this.subcategories.set(subcategories);
        this.loadPage(1);
      },
      error: (e) => console.error('Błąd ładowania kategorii:', e),
    });

    // obsługa wyszukiwarki – prefetch całości raz, gdy pojawi się zapytanie
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((raw) => {
          const term = (raw ?? '').trim();
          this.query.set(term);
          this.currentPage.set(1);

          if (term.length < 3 || this.allFetched()) return of(null);

          // PREFETCH WSZYSTKICH – bez filtra isActive
          return this.backend
            .getAll<Offer>('offers', 'title', 'asc')
            .pipe(
              tap((list) => {
                this.allOffers.set(list);
                this.allFetched.set(true);
              }),
              map(() => null)
            );
        })
      )
      .subscribe();
  }

  // --- UI API ---
  onSearchInput(ev: Event) {
    const val = (ev.target as HTMLInputElement | null)?.value ?? '';
    this.searchInput$.next(val);
  }

  onPageSizeClick(ev: Event) {
    const btn = (ev.target as HTMLElement | null)?.closest('button');
    const raw = btn?.getAttribute('data-size') ?? '';
    const size = Number(raw);
    if (!Number.isFinite(size)) return;
    if (this.pageSize() === size) return;
    this.pageSize.set(size);
    this.currentPage.set(1);
    if (!this.isSearchActive()) this.loadPage(1);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    if (!this.isSearchActive()) this.loadPage(page);
  }

  sortBy(field: OfferAdminSortField): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'createdAt' ? 'desc' : 'asc');
    }
    this.currentPage.set(1);
    if (!this.isSearchActive()) this.loadPage(1);
  }

  getSortIcon(field: OfferAdminSortField): string {
    if (this.sortField() !== field) return '';
    const dir = this.sortDir();
    const isNumeric =
      field === 'price' || field === 'stock' || field === 'createdAt';
    return isNumeric
      ? dir === 'asc'
        ? IconClass.NumericAsc
        : IconClass.NumericDesc
      : dir === 'asc'
      ? IconClass.AlphaAsc
      : IconClass.AlphaDesc;
  }

  // --- render helpers ---
  categoryName(catId: number | null | undefined): string {
    if (catId == null) return '—';
    return this.categories().find((c) => c.id === catId)?.name ?? '—';
  }
  subcategoryName(subId: number | null | undefined): string {
    if (subId == null) return '—';
    return this.subcategories().find((s) => s.id === subId)?.name ?? '—';
  }

  // --- search/sort client (z EAN/ISBN/slug) ---
  private filteredOffers = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (q.length < 3) return [] as Offer[];

    const list = this.allOffers();
    const withNames = list.map((o) => ({
      ...o,
      _category: this.categoryName(o.categoryId),
      _subcategory: this.subcategoryName(o.subcategoryId),
    }));

    const filtered = withNames.filter(
      (o) =>
        (o.title ?? '').toLowerCase().includes(q) ||
        (o._category ?? '').toLowerCase().includes(q) ||
        (o._subcategory ?? '').toLowerCase().includes(q) ||
        (o.slug ?? '').toLowerCase().includes(q) ||
        (o.ean ?? '').toLowerCase().includes(q) ||
        (o.isbn ?? '').toLowerCase().includes(q)
    );

    return this.clientSort(filtered);
  });

  private sortedPageOffers = computed(() => {
    const field = this.sortField();
    if (field === 'category' || field === 'subcategory') {
      const withNames = this.pageOffers().map((o) => ({
        ...o,
        _category: this.categoryName(o.categoryId),
        _subcategory: this.subcategoryName(o.subcategoryId),
      }));
      return this.clientSort(withNames);
    }
    return this.pageOffers();
  });

  private clientSort<
    T extends Offer & { _category?: string; _subcategory?: string }
  >(arr: T[]): Offer[] {
    const field = this.sortField();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    const valCat = (o: any) => (o._category ?? '').toLowerCase();
    const valSub = (o: any) => (o._subcategory ?? '').toLowerCase();

    const sorted = [...arr].sort((a, b) => {
      if (field === 'category')
        return (
          dir *
          valCat(a).localeCompare(valCat(b), 'pl', {
            numeric: true,
            sensitivity: 'base',
          })
        );
      if (field === 'subcategory')
        return (
          dir *
          valSub(a).localeCompare(valSub(b), 'pl', {
            numeric: true,
            sensitivity: 'base',
          })
        );
      return 0;
    });

    return sorted.map(({ _category, _subcategory, ...rest }) => rest);
  }

  private loadPage(page: number) {
    const field = this.sortField();
    const dir = this.sortDir();

    const pagination: IPagination = {
      page,
      pageSize: this.pageSize(),
    };

    const canServerSort = field !== 'category' && field !== 'subcategory';
    const sortKey: keyof Offer | undefined = canServerSort
      ? SERVER_COLUMN[field as keyof typeof SERVER_COLUMN]
      : undefined;
    const sortDir = canServerSort ? dir : 'asc';

    this.backend
      .getAll<Offer>('offers', sortKey, sortDir, pagination)
      .subscribe({
        next: (list) => {
          this.pageOffers.set(list);
          this.backend.getCount<Offer>('offers', pagination.filters).subscribe({
            next: (count) => this.totalOffers.set(count),
            error: () => this.totalOffers.set(list.length),
          });
        },
        error: () => {
          this.pageOffers.set([]);
          this.totalOffers.set(0);
        },
      });
  }
}
