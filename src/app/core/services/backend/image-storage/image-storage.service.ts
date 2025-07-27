import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ImageStorageService {
  private readonly supabase: SupabaseClient =
    inject(SupabaseService).getClient();

  uploadImage(file: File, path: string): Observable<string> {
    const fileName = `${Date.now()}.avif`;
    const fullPath = `${path}/${fileName}`;

    return from(
      this.supabase.storage.from('images').upload(fullPath, file, {
        contentType: 'image/avif',
        upsert: true,
      })
    ).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return fullPath;
      })
    );
  }

  uploadOrReplaceImage(
    file: File | null,
    path: string,
    previousPath: string | null
  ): Observable<string> {
    if (!file) return of(previousPath ?? '');

    const bucket = this.supabase.storage.from('images');
    const fullPath = `${path}/${file.name}`;

    const upload$ = from(
      bucket.upload(fullPath, file, {
        contentType: 'image/avif',
        upsert: true,
      })
    );

    const remove$: Observable<void> = previousPath
      ? from(bucket.remove([previousPath])).pipe(map(() => void 0))
      : of(void 0);

    return remove$.pipe(
      switchMap(() => upload$),
      map((res) => {
        if (res.error) throw new Error(res.error.message);
        return fullPath;
      })
    );
  }

  getOptimizedImageUrl(imageUrl: string, width = 600, height = 400): string {
    if (!imageUrl) return '';
    return `${imageUrl}?width=${width}&height=${height}`;
  }

  processImage<T extends { [key: string]: any }>(
    item: T,
    width = 600,
    height = 400
  ): T {
    for (const key in item) {
      if (
        Object.prototype.hasOwnProperty.call(item, key) &&
        key.toLowerCase().endsWith('image') &&
        typeof item[key] === 'string'
      ) {
        const imageUrl = item[key];
        if (imageUrl) {
          const { data } = this.supabase.storage
            .from('images')
            .getPublicUrl(imageUrl);

          const optimized = this.getOptimizedImageUrl(
            data.publicUrl,
            width,
            height
          );
          item[key] = optimized as T[Extract<keyof T, string>];
        }
      }
    }

    return item;
  }
}
