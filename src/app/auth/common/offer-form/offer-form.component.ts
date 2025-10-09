import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { CategoryService } from '../../../core/services/category/category.service';
import { OffersService } from '../../../core/services/offers/offers.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { ImageStorageService } from '../../../core/services/backend/image-storage/image-storage.service';
import { Category, Subcategory, Offer } from '../../../core/interfaces/i-offers';
import { toSlug } from '../../../core/utils/slug-creator';

type OfferForCreate = Omit<
  Offer,
  'id' | 'createdAt'
>;

@Component({
  selector: 'app-offer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgbDropdownModule],
  templateUrl: './offer-form.component.html',
  styleUrls: ['./offer-form.component.scss'],
})
export class OfferFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoriesSvc = inject(CategoryService);
  private readonly offersSvc = inject(OffersService);
  private readonly toast = inject(ToastService);
  private readonly images = inject(ImageStorageService);

  // dane referencyjne
  categories: Category[] = [];
  subcategories: Subcategory[] = [];

  // tryb
  readonly isEdit = signal<boolean>(false);
  private currentId: number | null = null;

  // obrazek
  private file = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  private imageMode = signal<'keep' | 'file' | 'remove'>('keep');

  // UI
  readonly titleText = computed(() => (this.isEdit() ? 'Edytuj produkt' : 'Nowy produkt'));

  // toasty
  readonly saveSuccessTpl = viewChild<TemplateRef<unknown>>('saveSuccessToast');
  readonly saveErrorTpl = viewChild<TemplateRef<unknown>>('saveErrorToast');

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    slug: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(80)]],
    description: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    categoryId: [null as number | null, [Validators.required]],
    subcategoryId: [null as number | null, [Validators.required]],
    buyNowLink: [''],
    ean: ['' as string | null],
    isbn: ['' as string | null],
    isActive: [true],
    image: [''], // zgodnie z interfejsem: string (pusta wartość = brak)
  });

  get f() { return this.form.controls; }

  ngOnInit(): void {
    // 1) kategorie/subkategorie, potem załaduj dane (jeśli edycja)
    this.categoriesSvc.loadCategories().subscribe({
      next: ({ categories, subcategories }) => {
        this.categories = categories;
        this.subcategories = subcategories;
        this.initFromRoute();
      },
      error: () => {
        this.categories = [];
        this.subcategories = [];
        this.initFromRoute();
      },
    });

    // 2) auto-slug dla trybu "create"
    this.f.title.valueChanges
      .pipe(startWith(this.f.title.value), takeUntilDestroyed())
      .subscribe((name) => {
        if (!this.isEdit()) {
          this.f.slug.setValue(toSlug(name ?? ''));
        }
      });

    // 3) zależność subkategorii
    this.f.categoryId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const curr = this.f.subcategoryId.value;
        if (curr != null) {
          const ok = this.subcategories.some((s) => s.id === curr && s.categoryId === (this.f.categoryId.value ?? -1));
          if (!ok) this.f.subcategoryId.setValue(null);
        }
      });
  }

  ngOnDestroy(): void {
    const prev = this.previewUrl();
    if (prev) URL.revokeObjectURL(prev);
  }

  private initFromRoute(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const idStr = this.route.snapshot.paramMap.get('id');

    if (slug) {
      this.isEdit.set(true);
      this.offersSvc.getBySlug(slug, true).subscribe({
        next: (offer) => this.patchFormForEdit(offer),
        error: () => this.patchFormForEdit(null),
      });
      return;
    }
    if (idStr) {
      const id = Number(idStr);
      this.isEdit.set(true);
      this.offersSvc.getById(id, true).subscribe({
        next: (offer) => this.patchFormForEdit(offer),
        error: () => this.patchFormForEdit(null),
      });
      return;
    }
    this.isEdit.set(false);
  }

  private patchFormForEdit(offer: Offer | null): void {
    if (!offer) {
      this.isEdit.set(false);
      return;
    }
    this.isEdit.set(true);
    this.currentId = offer.id;

    this.f.slug.setValue(offer.slug);
    this.form.patchValue({
      title: offer.title,
      description: offer.description ?? '',
      price: offer.price ?? 0,
      stock: offer.stock ?? 0,
      categoryId: offer.categoryId ?? null,
      subcategoryId: offer.subcategoryId ?? null,
      buyNowLink: offer.buyNowLink ?? '',
      ean: offer.ean ?? null,
      isbn: offer.isbn ?? null,
      isActive: (offer.isActive ?? true),
      image: offer.image ?? '',
    }, { emitEvent: false });

    // podgląd istniejącego (jeśli już CDN/URL) lub optymalizowany
    const existing = offer.image ?? '';
    if (existing) {
      if (/^https?:\/\//i.test(existing)) this.previewUrl.set(existing);
      else this.previewUrl.set(this.images.getOptimizedPublicUrl(existing, 800, 600));
    }
  }

  // -------- obrazek --------

  onImageChange(ev: Event): void {
    const input = ev.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.file.set(file);
    const prev = this.previewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.previewUrl.set(file ? URL.createObjectURL(file) : null);
    this.imageMode.set(file ? 'file' : 'keep');
  }

  removeImage(): void {
    const prev = this.previewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.previewUrl.set(null);
    this.file.set(null);
    this.f.image.setValue(''); // zgodnie z interfejsem: pusty string
    this.imageMode.set('remove');
  }

  // -------- dropdown helpers (naprawa TS2345) --------

  categoryName(id: number | null | undefined): string {
    if (id == null) return '—';
    return this.categories.find((c) => c.id === id)?.name ?? '—';
  }
  subcategoryName(id: number | null | undefined): string {
    if (id == null) return '—';
    return this.subcategories.find((s) => s.id === id)?.name ?? '—';
  }
  subcatsForSelectedCategory(): Subcategory[] {
    const cat = this.f.categoryId.value ?? null;
    return this.subcategories.filter((s) => s.categoryId === cat);
  }

  // -------- akcje --------

  submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();

    const payload: OfferForCreate = {
      // pola główne
      uid: undefined,
      slug: raw.slug || toSlug(raw.title),
      ean: raw.ean ?? null,
      isbn: raw.isbn ?? null,
      title: raw.title,
      description: raw.description || '',
      price: Number(raw.price ?? 0),
      stock: Number(raw.stock ?? 0),
      image: raw.image || '', // string
      buyNowLink: raw.buyNowLink || '',
      categoryId: raw.categoryId as number,
      subcategoryId: (raw.subcategoryId as number),
      isActive: !!raw.isActive,
    };

    const file = this.file();

    const ok = (redirectSlug: string) => {
      const t = this.saveSuccessTpl();
      if (t) this.toast.show({ template: t, classname: 'bg-success text-white', header: 'Zapisano produkt' });
      this.router.navigate(['/admin/offers']);
    };
    const err = () => {
      const t = this.saveErrorTpl();
      if (t) this.toast.show({ template: t, classname: 'bg-danger text-white', header: 'Nie udało się zapisać' });
    };

    if (this.isEdit() && this.currentId != null) {
      const patch: Partial<OfferForCreate> = { ...payload };
      // usuń pseudo-pola, które i tak nie idą w UPDATE
      delete (patch as any).id;
      delete (patch as any).createdAt;
      delete (patch as any).uid;

      // jeśli usuwamy istniejący obrazek a nie uploadujemy nowego — ustaw pusty string
      if (this.imageMode() === 'remove' && !file) patch.image = '';

      this.offersSvc.updateOffer(this.currentId, patch, file ?? undefined).subscribe({
        next: () => ok(payload.slug),
        error: () => err(),
      });
      return;
    }

    // CREATE
    this.offersSvc.createOffer(payload, file ?? undefined).subscribe({
      next: ({ slug }) => ok(slug),
      error: () => err(),
    });
  }
}
