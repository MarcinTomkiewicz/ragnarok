import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { BackendService } from '../backend/backend.service';
import { FilterOperator } from '../../enums/filterOperator';
import { toSnakeCase } from '../../utils/type-mappers';
import { Offer, OfferImage } from '../../interfaces/i-offers';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';

type OfferForCreate = Omit<Offer, 'id' | 'createdAt' | 'images'>;

@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly backend = inject(BackendService);
  private readonly images = inject(ImageStorageService);

  /** ------- READ ------- */

  getBySlug(slug: string, processImages = true): Observable<Offer | null> {
    // dociągnijmy też obrazy:
    return this.backend
      .getAll<any>(
        'offers',
        undefined,
        'asc',
        {
          filters: { slug: { operator: FilterOperator.EQ, value: slug } },
        },
        undefined,
        'offers_images(*)', // join
        processImages
      )
      .pipe(
        map((rows) => {
          const row = rows?.[0] ?? null;
          if (!row) return null;
          const images: OfferImage[] =
            (row.offersImages ?? []).map((r: any) => ({
              id: r.id,
              offerId: r.offerId,
              path: r.path,
              isPrimary: !!r.isPrimary,
              sortIndex: r.sortIndex ?? null,
              createdAt: r.createdAt,
            })) ?? [];
          const offer: Offer = {
            ...row,
            images,
          };
          return offer;
        })
      );
  }

  getById(id: number, processImages = true): Observable<Offer | null> {
    return this.backend
      .getAll<any>(
        'offers',
        undefined,
        'asc',
        {
          filters: { id: { operator: FilterOperator.EQ, value: id } },
        },
        undefined,
        'offers_images(*)',
        processImages
      )
      .pipe(
        map((rows) => {
          const row = rows?.[0] ?? null;
          if (!row) return null;
          const images: OfferImage[] =
            (row.offersImages ?? []).map((r: any) => ({
              id: r.id,
              offerId: r.offerId,
              path: r.path,
              isPrimary: !!r.isPrimary,
              sortIndex: r.sortIndex ?? null,
              createdAt: r.createdAt,
            })) ?? [];
          const offer: Offer = {
            ...row,
            images,
          };
          return offer;
        })
      );
  }

  getAllActive(): Observable<Offer[]> {
    return this.backend.getAll<Offer>('offers', 'title', 'asc', {
      filters: { isActive: { operator: FilterOperator.EQ, value: true } },
    });
  }

  listImages(offerId: number): Observable<OfferImage[]> {
    return this.backend
      .getAll<OfferImage>('offers_images', 'sortIndex' as any, 'asc', {
        filters: { offerId: { operator: FilterOperator.EQ, value: offerId } },
      })
      .pipe(map((rows) => rows ?? []));
  }

  /** ------- WRITE ------- */

  createOffer(
    data: OfferForCreate,
    imageFiles?: File[] | null,
    primaryIndex?: number | null // który z dodawanych nowych plików ma być główny; domyślnie 0
  ): Observable<{ id: number; slug: string }> {
    const core = { ...data };

    return this.backend.create('offers', toSnakeCase(core) as any).pipe(
      switchMap((created: any) => {
        const id = Number(created?.id);
        const slug = String(created?.slug ?? '');
        const uid = (created?.uid as string | undefined) ?? undefined;
        if (!Number.isFinite(id)) return throwError(() => new Error('Insert offers failed'));

        const files = imageFiles ?? [];
        if (!files.length) return of({ id, slug });

        return this.uploadGallery(id, uid ?? String(id), files, primaryIndex ?? 0).pipe(
          switchMap((primaryPath) => this.syncMainImageFromPrimary(id, primaryPath)),
          map(() => ({ id, slug }))
        );
      })
    );
  }

  updateOffer(
    id: number,
    patch: Partial<OfferForCreate>,
    newFiles?: File[] | null,
    toRemoveIds?: string[] | null,
    setPrimaryImageId?: string | null
  ): Observable<void> {
    const ops: Observable<unknown>[] = [];

    if (patch && Object.keys(patch).length) {
      ops.push(this.backend.update('offers', id, toSnakeCase(patch) as any));
    }

    if (Array.isArray(toRemoveIds) && toRemoveIds.length) {
      ops.push(
        this.backend.delete('offers_images', {
          id: { operator: FilterOperator.IN, value: toRemoveIds },
          offer_id: { operator: FilterOperator.EQ, value: id },
        } as any)
      );
    }

    if (newFiles?.length) {
      ops.push(
        this.backend.getById<Offer>('offers', id, undefined, undefined, false).pipe(
          switchMap((row) => {
            const uid = (row as any)?.uid as string | undefined;
            return this.uploadGallery(id, uid ?? String(id), newFiles, null).pipe(map(() => void 0));
          })
        )
      );
    }

    if (setPrimaryImageId) {
      ops.push(this.setPrimaryImage(id, setPrimaryImageId));
    }

    const exec$ = ops.length ? forkJoin(ops).pipe(map(() => void 0)) : of(void 0);

    return exec$.pipe(
      // po zmianach zsynchronizuj legacy pole Offer.image
      switchMap(() =>
        this.backend
          .getAll<OfferImage>('offers_images', undefined, 'asc', {
            filters: {
              offerId: { operator: FilterOperator.EQ, value: id },
              isPrimary: { operator: FilterOperator.EQ, value: true },
            },
          })
          .pipe(
            map((rows) => rows?.[0] ?? null),
            switchMap((primary) => this.syncMainImageFromPrimary(id, primary?.path ?? ''))
          )
      ),
      map(() => void 0)
    );
  }

  deleteImage(imageId: string): Observable<void> {
    return this.backend.delete('offers_images', imageId);
  }

setPrimaryImage(offerId: number, imageId: string): Observable<void> {
  // pobierz wszystkie obrazki oferty
  return this.backend
    .getAll<OfferImage>('offers_images', 'sortIndex' as any, 'asc', {
      filters: { offerId: { operator: FilterOperator.EQ, value: offerId } },
    })
    .pipe(
      switchMap((rows) => {
        const imgs = rows ?? [];
        if (!imgs.length) return of(void 0);

        // ustaw dokładnie jednego jako primary, resztę na false
        const ops = imgs.map((r) =>
          this.backend.update('offers_images', (r as any).id, {
            isPrimary: (r as any).id === imageId,
          } as any)
        );
        return forkJoin(ops).pipe(map(() => void 0));
      })
    );
}


  /** ------- helpers ------- */

  private uploadGallery(
    offerId: number,
    folderKey: string,
    files: File[],
    primaryIdx: number | null
  ): Observable<string | null> {
    // upload + insert rows w offers_images
    const base = `offers/${folderKey}/gallery`;

    return forkJoin(
      files.map((file) =>
        this.images
          .transcodeAndUpload(file, base, {
            keepBaseName: true,
            uniqueStrategy: 'date',
            dateFormat: 'dd-MM-yyyy-HHmmss',
            prefer: 'avif',
            quality: 0.82,
            maxW: 1600,
            maxH: 1200,
            largerFallbackFactor: 1.15,
          })
          .pipe(map((path) => ({ path })))
      )
    ).pipe(
      switchMap((uploaded) => {
        const items = uploaded.map((u, idx) => ({
          offerId,
          path: u.path,
          isPrimary: primaryIdx !== null ? idx === primaryIdx : false,
          sortIndex: idx,
        }));
        return this.backend.createMany('offers_images', toSnakeCase(items) as any).pipe(
          map((rows: any[]) => {
            const primaryRow =
              (rows ?? []).find((r: any) => !!r.is_primary) ??
              (rows ?? [])[0] ??
              null;
            return (primaryRow?.path as string | undefined) ?? null;
          })
        );
      })
    );
  }

  /** zsynchronizuj Offer.image z aktualnym primary */
  private syncMainImageFromPrimary(offerId: number, primaryPath: string | null): Observable<void> {
    const path = primaryPath ?? '';
    return this.backend.update('offers', offerId, { image: path } as any).pipe(map(() => void 0));
  }

  /** helpers do URL-i */
  public publicUrl(path?: string | null, w = 800, h = 600): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return this.images.getOptimizedPublicUrl(path, w, h);
  }
}
