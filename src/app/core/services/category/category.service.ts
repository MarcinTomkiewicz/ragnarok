import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Category, Subcategory } from '../../interfaces/i-offers';
import { BackendService } from '../backend/backend.service';
import { CategoryType } from '../../enums/categories';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly categories$ = new BehaviorSubject<Category[]>([]);
  private readonly subcategories$ = new BehaviorSubject<Subcategory[]>([]);
  private readonly backendService = inject(BackendService);
  private dataLoaded = false;

  loadCategories(): Observable<{
    categories: Category[];
    subcategories: Subcategory[];
  }> {
    if (this.dataLoaded) {
      return of({
        categories: this.categories$.value,
        subcategories: this.subcategories$.value,
      });
    }

    const categories$ = this.backendService.getAll<Category>(
      'categories',
      'id',
      'asc'
    );
    const subcategories$ = this.backendService.getAll<Subcategory>(
      'subcategories',
      'name',
      'asc'
    );

    return forkJoin({
      categories: categories$,
      subcategories: subcategories$,
    }).pipe(
      tap(({ categories, subcategories }) => {
        const sortedCategories = [...categories].sort((a, b) => {
          if (a.name === 'Inne') return 1;
          if (b.name === 'Inne') return -1;
          return a.name.localeCompare(b.name);
        });

        this.categories$.next(sortedCategories);
        const sortedSubcategories = [...subcategories].sort((a, b) => {
          const aIsInne = a.name.toLowerCase() === 'inne';
          const bIsInne = b.name.toLowerCase() === 'inne';

          if (aIsInne && !bIsInne) return 1;
          if (!aIsInne && bIsInne) return -1;

          return a.name.localeCompare(b.name);
        });
        
        this.subcategories$.next(sortedSubcategories);

        this.dataLoaded = true;
      })
    );
  }

  getCategoryName(id: number, category: CategoryType): string {
    const source =
      category === CategoryType.CATEGORY
        ? this.categories$.value
        : this.subcategories$.value;
    const name = source.find((item) => item.id === id)?.name;
    return name ?? '';
  }
}
