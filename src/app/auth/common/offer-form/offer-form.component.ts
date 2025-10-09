import { CommonModule } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  OnInit,
  TemplateRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { register } from 'swiper/element/bundle';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import {
  Category,
  Offer,
  OfferImage,
  Subcategory,
} from '../../../core/interfaces/i-offers';
import { OffersService } from '../../../core/services/offers/offers.service';
import { CategoryService } from '../../../core/services/category/category.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { PlatformService } from '../../../core/services/platform/platform.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { toSlug } from '../../../core/utils/slug-creator';

type OfferForCreate = Omit<Offer, 'id' | 'createdAt'>;

type PrimaryRef =
  | '' // brak
  | 'legacy' // główny z pola legacy offer.image
  | `img:${string}` // istniejący obrazek z DB (id)
  | `new:${number}`; // indeks nowo dodanego pliku

@Component({
  selector: 'app-offer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgbDropdownModule],
  templateUrl: './offer-form.component.html',
  styleUrls: ['./offer-form.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class OfferFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offers = inject(OffersService);
  private readonly cats = inject(CategoryService);
  private readonly seo = inject(SeoService);
  private readonly platform = inject(PlatformService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // dane referencyjne
  categories = signal<Category[]>([]);
  subcategories = signal<Subcategory[]>([]);

  // stan edycji
  offer = signal<Offer | null>(null);

  // galeria – istniejące
  existing = signal<OfferImage[]>([]);
  toRemove = signal<Set<string>>(new Set());

  // nowe pliki (do uploadu) + ich obiekty URL
  newFiles = signal<File[]>([]);
  newPreviews = signal<string[]>([]);

  // wskaźnik głównego
  primaryRef = signal<PrimaryRef>('legacy');

  // toasty
  readonly offerSuccessTpl =
    viewChild<TemplateRef<unknown>>('offerSuccessToast');
  readonly offerErrorTpl = viewChild<TemplateRef<unknown>>('offerErrorToast');

  // form
  form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    slug: [{ value: '', disabled: true }, [Validators.required]],
    description: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    categoryId: [null as number | null, [Validators.required]],
    subcategoryId: [null as number | null, [Validators.required]],
    buyNowLink: [''],
    ean: [''],
    isbn: [''],
    isActive: [true],
    image: [''], // legacy pole – utrzymujemy
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Edycja produktu');

    if (this.platform.isBrowser) register();

    this.cats.loadCategories().subscribe({
      next: ({ categories, subcategories }) => {
        this.categories.set(categories);
        this.subcategories.set(subcategories);
      },
      error: (e) => console.error('Błąd pobierania kategorii:', e),
    });

    const slug = this.route.snapshot.paramMap.get('slug');
    const idStr = this.route.snapshot.paramMap.get('id');
    if (slug) {
      this.offers.getBySlug(slug).subscribe({
        next: (o) => this.afterLoad(o),
        error: (e) => console.error('Błąd pobierania oferty:', e),
      });
    } else if (idStr) {
      const id = Number(idStr);
      this.offers.getById(id).subscribe({
        next: (o) => this.afterLoad(o),
        error: (e) => console.error('Błąd pobierania oferty:', e),
      });
    } else {
      // nowa – slug z tytułu
      this.f.title.valueChanges
        .pipe(
          startWith(this.f.title.value),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((v) => this.f.slug.setValue(toSlug(v || '')));
    }
  }

  private afterLoad(o: Offer | null) {
    if (!o) return;
    this.offer.set(o);

    this.form.patchValue({
      title: o.title,
      slug: o.slug,
      description: o.description,
      price: o.price,
      stock: o.stock,
      categoryId: o.categoryId ?? null,
      subcategoryId: o.subcategoryId ?? null,
      buyNowLink: o.buyNowLink ?? '',
      ean: o.ean ?? '',
      isbn: o.isbn ?? '',
      isActive: o.isActive ?? true,
      image: o.image ?? '',
    });

    const imgs = (o as any).images as OfferImage[] | undefined;
    this.existing.set(imgs ?? []);

    // domyślny „główny”
    const primary = imgs?.find((x) => x.isPrimary);
    if (primary) this.primaryRef.set(`img:${primary.id}`);
    else
      this.primaryRef.set(
        o.image ? 'legacy' : imgs?.[0] ? `img:${imgs[0].id}` : ''
      );
  }

  // --------- helpers ----------
  publicUrl(path?: string | null, w = 800, h = 600): string {
    return this.offers.publicUrl(path ?? '', w, h) ?? '';
  }

  // --------- dropdown helpers ----------
  categoryLabel(): string {
    const id = this.form.value.categoryId ?? null;
    if (id === null) return '— wybierz —';
    return this.categories().find((c) => c.id === id)?.name ?? '— wybierz —';
  }

  subcategoryLabel(): string {
    const id = this.form.value.subcategoryId ?? null;
    if (id === null) return '— wybierz —';
    return this.subcategories().find((s) => s.id === id)?.name ?? '— wybierz —';
  }

  filteredSubcategories(): Subcategory[] {
    const catId = this.form.value.categoryId ?? null;
    if (catId === null) return [];
    return this.subcategories().filter((s) => s.categoryId === catId);
  }

  pickCategory(id: number) {
    this.f.categoryId.setValue(id);
    // reset subkategorii jeśli nie pasuje
    const currentSub = this.form.value.subcategoryId ?? null;
    if (
      !currentSub ||
      !this.filteredSubcategories().some((s) => s.id === currentSub)
    ) {
      this.f.subcategoryId.setValue(null);
    }
  }

  pickSubcategory(id: number) {
    this.f.subcategoryId.setValue(id);
  }

  // --------- galeria ----------
  onAddImages(ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    if (!files.length) return;

    const list = [...this.newFiles(), ...files];

    // czyść stare blob URL
    this.newPreviews().forEach((u) => URL.revokeObjectURL(u));
    const previews = list.map((f) => URL.createObjectURL(f));

    this.newFiles.set(list);
    this.newPreviews.set(previews);

    // jeśli nic nie jest główne – ustaw pierwszy nowy
    if (!this.primaryRef()) this.primaryRef.set('new:0');
  }

  removeNewAt(index: number) {
    const files = [...this.newFiles()];
    const prevs = [...this.newPreviews()];
    const url = prevs[index];
    if (url) URL.revokeObjectURL(url);
    files.splice(index, 1);
    prevs.splice(index, 1);
    this.newFiles.set(files);
    this.newPreviews.set(prevs);

    if (this.primaryRef() === `new:${index}`) {
      // przesuń na pierwszy sensowny
      const remainingNew = this.newPreviews();
      if (remainingNew.length) this.primaryRef.set('new:0');
      else if (this.existing().length)
        this.primaryRef.set(`img:${this.existing()[0].id}`);
      else if (this.offer()?.image) this.primaryRef.set('legacy');
      else this.primaryRef.set('');
    }
  }

  toggleRemoveExisting(img: OfferImage) {
    const set = new Set(this.toRemove());
    if (set.has(img.id)) set.delete(img.id);
    else set.add(img.id);
    this.toRemove.set(set);

    // jeśli kasujemy aktualnego primary – przepnij
    if (this.primaryRef() === `img:${img.id}` && set.has(img.id)) {
      const stillThere = this.existing().filter((x) => !set.has(x.id));
      if (stillThere.length) this.primaryRef.set(`img:${stillThere[0].id}`);
      else if (this.newPreviews().length) this.primaryRef.set('new:0');
      else if (this.offer()?.image) this.primaryRef.set('legacy');
      else this.primaryRef.set('');
    }
  }

  pickPrimaryExisting(img: OfferImage) {
    if (this.toRemove().has(img.id)) return;
    this.primaryRef.set(`img:${img.id}`);
  }
  pickPrimaryNew(index: number) {
    this.primaryRef.set(`new:${index}`);
  }

  // --------- zapisz ----------
  save() {
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const base: OfferForCreate = {
      uid: this.offer()?.uid,
      slug: v.slug,
      ean: v.ean || null,
      isbn: v.isbn || null,
      title: v.title,
      description: v.description,
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
      image: v.image || '',
      buyNowLink: v.buyNowLink || '',
      categoryId: v.categoryId as number,
      subcategoryId: v.subcategoryId as number,
      createdAt: this.offer()?.createdAt ?? new Date().toISOString(),
      isActive: !!v.isActive,
    } as unknown as OfferForCreate;

    const isEdit = !!this.offer();
    const newFiles = this.newFiles();
    const removeIds = Array.from(this.toRemove());
    const ref = this.primaryRef();

    if (!isEdit) {
      let primaryIndex: number | null = null;
      if (ref.startsWith('new:')) primaryIndex = Number(ref.slice(4));
      const idx = primaryIndex ?? (newFiles.length ? 0 : null);

      this.offers.createOffer(base, newFiles, idx).subscribe({
        next: () => {
          this.cleanupBlobs();
          this.showSuccessToast();
          this.router.navigate(['/auth/offers']);
        },
        error: () => {
          this.showErrorToast();
        },
      });
      return;
    }

    const currentPrimaryId =
      this.existing().find((x) => x.isPrimary)?.id ?? null;
    const requestedPrimaryId = ref.startsWith('img:')
      ? ref.slice(4)
      : ref === 'legacy'
      ? null
      : null;

    const setPrimaryImageId =
      requestedPrimaryId && requestedPrimaryId !== currentPrimaryId
        ? requestedPrimaryId
        : null;

    this.offers
      .updateOffer(
        this.offer()!.id,
        base,
        newFiles,
        removeIds,
        setPrimaryImageId
      )
      .subscribe({
        next: () => {
          if (ref.startsWith('new:')) {
            // po uploadzie ustawiamy primary po nazwie pliku (keepBaseName: true)
            const idx = Number(ref.slice(4));
            const file = newFiles[idx];
            if (!file) return this.finishSaveOk();

            const needle = this.stripExt(file.name).toLowerCase();

            this.offers.listImages(this.offer()!.id).subscribe({
              next: (rows) => {
                const match = rows.find((r) =>
                  (r.path || '').toLowerCase().includes(needle)
                );
                if (!match) return this.finishSaveOk();
                this.offers
                  .setPrimaryImage(this.offer()!.id, match.id)
                  .subscribe({
                    next: () => this.finishSaveOk(),
                    error: () => this.finishSaveOk(),
                  });
              },
              error: () => this.finishSaveOk(),
            });
          } else {
            this.finishSaveOk();
          }
        },
        error: () => this.showErrorToast(),
      });
  }

  private finishSaveOk() {
    this.cleanupBlobs();
    this.showSuccessToast();
    this.router.navigate(['/auth/offers']);
  }

  private showSuccessToast() {
    const tpl = this.offerSuccessTpl();
    if (tpl)
      this.toast.show({
        template: tpl,
        classname: 'bg-success text-white',
        header: 'Zapisano produkt',
      });
  }
  private showErrorToast() {
    const tpl = this.offerErrorTpl();
    if (tpl)
      this.toast.show({
        template: tpl,
        classname: 'bg-danger text-white',
        header: 'Nie udało się zapisać produktu',
      });
  }

  private stripExt(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(0, i) : name;
  }

  private cleanupBlobs() {
    this.newPreviews().forEach((u) => URL.revokeObjectURL(u));
    this.newPreviews.set([]);
    this.newFiles.set([]);
  }
}
