import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbAccordionModule, NgbDropdownModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { CategoryListComponent } from '../../common/category-list/category-list/category-list.component';
import { CategoryType } from '../../core/enums/categories';
import { Category, Offer, Subcategory } from '../../core/interfaces/i-offers';
import { BackendService, IPagination } from '../../core/services/backend/backend.service';
import { CategoryService } from '../../core/services/category/category.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { FilterOperator } from '../../core/enums/filterOperator';
import { IFilters } from '../../core/interfaces/i-filters';

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

  currentPage = 1;
  pageSize = 10;
  totalOffers = 0;

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
  
  loadOffers(page: number = this.currentPage, subcategoryId: number | null = null): void {
    const pagination: IPagination = {
      page: page,
      pageSize: this.pageSize,
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
      complete: () => console.log('Oferty zostały pobrane')
    });
  }
  

  updateTotalOffers(filters?: IFilters): void {
    this.backendService.getCount<Offer>('offers', filters).subscribe({
      next: (count) => {
        this.totalOffers = count;
      },
      error: (err) => console.error('Błąd podczas liczenia ofert:', err)
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOffers(page);
  }


  filterOffersBySubcategory(subcategoryId: number | null): void {
    if (subcategoryId === null) {
      this.filteredOffers = this.offersList;
    } else {
      this.filteredOffers = this.offersList.filter(
        (offer) => offer.subcategoryId === subcategoryId
      );
    }
  }

  onSubcategoryClick(subcategoryId: number | null): void {
    this.currentPage = 1; // Resetujemy paginację przy zmianie filtra
    this.loadOffers(this.currentPage, subcategoryId);
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
