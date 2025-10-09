import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { BackendService } from '../backend/backend.service';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';
import { FilterOperator } from '../../enums/filterOperator';
import { toSnakeCase } from '../../utils/type-mappers';
import { Offer } from '../../interfaces/i-offers';

type OfferForCreate = Omit<
  Offer,
  'id' | 'createdAt'
>;

@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly backend = inject(BackendService);
  private readonly images = inject(ImageStorageService);

  /** Pobierz po slug (1 rekord) */
  getBySlug(slug: string, processImages = true): Observable<Offer | null> {
    return this.backend.getOneByFields<Offer>(
      'offers',
      { slug },
      undefined,
      undefined,
      processImages
    );
  }

  /** Pobierz po id (1 rekord) */
  getById(id: number, processImages = true): Observable<Offer | null> {
    return this.backend.getById<Offer>('offers', id, undefined, undefined, processImages);
  }

  /** Lista aktywnych (przykład użycia) */
  getAllActive(): Observable<Offer[]> {
    return this.backend.getAll<Offer>('offers', 'title', 'asc', {
      filters: { isActive: { operator: FilterOperator.EQ, value: true } },
    });
  }

  /** Utwórz ofertę i (opcjonalnie) wyślij główne zdjęcie do offers/{uid|id}/main */
  createOffer(
    data: OfferForCreate,
    imageFile?: File | null
  ): Observable<{ id: number; slug: string }> {
    const core = { ...data };

    return this.backend.create('offers', toSnakeCase(core) as any).pipe(
      switchMap((created: any) => {
        const id = Number(created?.id);
        const slug = String(created?.slug ?? '');
        const uid = (created?.uid as string | undefined) ?? undefined;
        if (!Number.isFinite(id)) return throwError(() => new Error('Insert offers failed'));

        if (!imageFile) return of({ id, slug });

        return this.uploadMainImage(uid ?? String(id), imageFile).pipe(
          switchMap((fullPath) =>
            this.backend.update('offers', id, { image: fullPath } as any)
          ),
          map(() => ({ id, slug }))
        );
      })
    );
  }

  /** Zaktualizuj ofertę, a gdy podasz imageFile – podmień główne zdjęcie */
  updateOffer(
    id: number,
    patch: Partial<OfferForCreate>,
    imageFile?: File | null
  ): Observable<void> {
    const ops: Observable<unknown>[] = [];

    if (patch && Object.keys(patch).length) {
      ops.push(this.backend.update('offers', id, toSnakeCase(patch) as any));
    }

    if (imageFile) {
      // najpierw pobierz uid/id do ścieżki
      ops.push(
        this.backend.getById<Offer>('offers', id, undefined, undefined, false).pipe(
          switchMap((row) => {
            const uid = (row as any)?.uid as string | undefined;
            const folderKey = uid ?? String(id);
            return this.uploadMainImage(folderKey, imageFile).pipe(
              switchMap((fullPath) =>
                this.backend.update('offers', id, { image: fullPath } as any)
              )
            );
          })
        )
      );
    }

    if (!ops.length) return of(void 0) as Observable<void>;
    return forkJoin(ops).pipe(map(() => void 0));
  }

  /** Upload + transkodowanie głównego obrazka */
  private uploadMainImage(folderKey: string, file: File): Observable<string> {
    const basePath = `offers/${folderKey}/main`;
    return this.images
      .transcodeAndUpload(file, basePath, {
        keepBaseName: true,
        uniqueStrategy: 'date',
        dateFormat: 'dd-MM-yyyy-HHmmss',
        prefer: 'avif',
        quality: 0.82,
        maxW: 1600,
        maxH: 1200,
        largerFallbackFactor: 1.15,
      })
      .pipe(
        switchMap((fullPath) => (fullPath ? of(fullPath) : throwError(() => new Error('Upload failed'))))
      );
  }
}
