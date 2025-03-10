import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Category, Subcategory } from '../../interfaces/i-offers';
import { BackendService } from '../backend/backend.service';
import { CategoryType } from '../../enums/categories';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly categories$ = new BehaviorSubject<Category[]>([]);
  private readonly subcategories$ = new BehaviorSubject<Subcategory[]>([]);
  private readonly backendService = inject(BackendService)
  private dataLoaded = false;

  

  loadCategories(): Observable<{ categories: Category[], subcategories: Subcategory[] }> {
    if (this.dataLoaded) {
      return of({
        categories: this.categories$.value,
        subcategories: this.subcategories$.value
      });
    }

    const categories$ = this.backendService.getAll<Category>('categories', 'id', 'asc');
    const subcategories$ = this.backendService.getAll<Subcategory>('subcategories', 'id', 'asc');

    return forkJoin({ categories: categories$, subcategories: subcategories$ }).pipe(
      tap(({ categories, subcategories }) => {
        this.categories$.next(categories);
        this.subcategories$.next(subcategories);
        this.dataLoaded = true;
      })
    );
  }

  getCategoryName(id: number, category: CategoryType): string {
    const source = category === CategoryType.CATEGORY ? this.categories$.value : this.subcategories$.value;
    const name = source.find(item => item.id === id)?.name;
    return name ?? '';
  }
}
