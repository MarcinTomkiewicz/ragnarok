import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbAccordionModule, NgbDropdownModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { CategoryListComponent } from '../../common/category-list/category-list/category-list.component';
import { CategoryType } from '../../core/enums/categories';
import { FilterOperator } from '../../core/enums/filterOperator';
import { IFilters } from '../../core/interfaces/i-filters';
import { Category, Offer, Subcategory } from '../../core/interfaces/i-offers';
import { BackendService, IPagination } from '../../core/services/backend/backend.service';
import { CategoryService } from '../../core/services/category/category.service';
import { PlatformService } from '../../core/services/platform/platform.service';

@Component({
  selector: 'app-offers-list',
  standalone: true,
  imports: [CommonModule, NgbAccordionModule, NgbDropdownModule, RouterModule, CategoryListComponent, NgbPaginationModule],
  templateUrl: './offers-list.component.html',
  styleUrl: './offers-list.component.scss'
})
export class OffersListComponent implements OnInit {

  private readonly backendService = inject(BackendService)
  private readonly platformService = inject(PlatformService);
  readonly categoryService = inject(CategoryService)
  readonly CategoryType = CategoryType

  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  offersList: Offer[] = [];
  filteredOffers: Offer[] = [];

  // Zamieniamy na sygnały
  currentSubcategoryId = signal<number | null>(null);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalOffers = signal<number>(0);

  ngOnInit(): void {
    this.categoryService.loadCategories().subscribe({
      next: ({ categories, subcategories }) => {
        this.categories = categories;
        this.subcategories = subcategories;
        this.loadOffers();
      },
      error: (err) => console.error('Błąd podczas pobierania kategorii:', err)
    });
  }
  
  loadOffers(page: number = this.currentPage()): void { // <-- Teraz currentPage to sygnał, więc wywołujemy jako funkcję
    const subcategoryId = this.currentSubcategoryId();
    const pagination: IPagination = {
      page: page,
      pageSize: this.pageSize(), // <-- pageSize też sygnał
      filters: subcategoryId
        ? {
            subcategoryId: {
              operator: FilterOperator.EQ,
              value: subcategoryId
            }
          }
        : undefined
    };
  
    this.backendService.getAll<Offer>('offers', 'id', 'asc', pagination).subscribe({
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
      error: (err) => console.error('Błąd podczas liczenia ofert:', err)
    });
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
}

