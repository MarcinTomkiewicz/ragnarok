import { Component, EventEmitter, input, Output } from '@angular/core';
import { Category, Subcategory } from '../../../core/interfaces/i-offers';
import {
  NgbAccordionModule,
  NgbDropdownModule,
} from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { outputToObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [NgbAccordionModule, NgbDropdownModule],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent {
  readonly categories = input<Category[]>();
  readonly subcategories = input<Subcategory[]>();
  @Output() subcategorySelected = new EventEmitter<number | null>();

  activeCategoryId: number | null = null;
  subcategorySelected$ = outputToObservable(this.subcategorySelected);

  onSubcategoryClick(subcategoryId: number | null): void {
    this.subcategorySelected.next(subcategoryId);
  }
  
  showAll(accordion: any): void {
    accordion.collapseAll();
    this.subcategorySelected.next(null);
  }
}
