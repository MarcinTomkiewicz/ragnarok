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

  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from('images').getPublicUrl(path);
    return data.publicUrl;
  }

  getOptimizedPublicUrl(path: string, width = 600, height = 400): string {
    return `${this.getPublicUrl(path)}?width=${width}&height=${height}`;
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

  transcodeAndUpload(
    file: File,
    basePath: string,
    opts?: {
      maxW?: number;
      maxH?: number;
      prefer?: 'avif' | 'webp';
      quality?: number;
      keepBaseName?: boolean;
      uniqueStrategy?: 'none' | 'date' | 'timestamp' | 'random';
      dateFormat?: string;
      largerFallbackFactor?: number; 
    }
  ): Observable<string> {
    const maxW = opts?.maxW ?? 1600;
    const maxH = opts?.maxH ?? 1200;
    const prefer = opts?.prefer ?? 'avif';
    const quality = opts?.quality ?? 0.82;
    const keepBaseName = opts?.keepBaseName ?? true;
    const uniqueStrategy = opts?.uniqueStrategy ?? 'date';
    const dateFormat = opts?.dateFormat ?? 'dd-MM-yyyy-HHmmss';
    const largerFallbackFactor = opts?.largerFallbackFactor ?? 1.15;

    const extOf = (name: string) => {
      const m = name.match(/\.([^.]+)$/);
      return m ? m[1].toLowerCase() : '';
    };

    const baseNameOf = (name: string) => name.replace(/\.[^.]+$/, '');

    const slugBase = (name: string) => {
      const base = keepBaseName ? baseNameOf(name) : 'file';
      const slug = base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      return slug || 'file';
    };

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDate = (d: Date, fmt: string) =>
      fmt
        .replace(/yyyy/g, String(d.getFullYear()))
        .replace(/MM/g, pad(d.getMonth() + 1))
        .replace(/dd/g, pad(d.getDate()))
        .replace(/HH/g, pad(d.getHours()))
        .replace(/mm/g, pad(d.getMinutes()))
        .replace(/ss/g, pad(d.getSeconds()));

    const uniqueSuffix = (): string => {
      if (uniqueStrategy === 'none') return '';
      if (uniqueStrategy === 'random')
        return Math.random().toString(36).slice(2, 8);
      if (uniqueStrategy === 'timestamp') {
        const d = new Date();
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
          d.getDate()
        )}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      }
      return formatDate(new Date(), dateFormat);
    };

    const loadImage = (blob: Blob) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });

    const toBlob = (canvas: HTMLCanvasElement, mime: string, q: number) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, mime, q));

    const tryEncode = async (
      canvas: HTMLCanvasElement
    ): Promise<{ blob: Blob; ext: string; mime: string } | null> => {
      if (prefer === 'avif') {
        const avif = await toBlob(canvas, 'image/avif', quality);
        if (avif) return { blob: avif, ext: 'avif', mime: 'image/avif' };
        const webp = await toBlob(canvas, 'image/webp', quality);
        if (webp) return { blob: webp, ext: 'webp', mime: 'image/webp' };
      } else {
        const webp = await toBlob(canvas, 'image/webp', quality);
        if (webp) return { blob: webp, ext: 'webp', mime: 'image/webp' };
        const avif = await toBlob(canvas, 'image/avif', quality);
        if (avif) return { blob: avif, ext: 'avif', mime: 'image/avif' };
      }
      return null;
    };

    const downscaleAndEncode = async (
      src: Blob
    ): Promise<{ blob: Blob; ext: string; mime: string } | null> => {
      const img = await loadImage(src);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const ratio = Math.min(maxW / width, maxH / height, 1);
      const targetW = Math.round(width * ratio);
      const targetH = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, targetW, targetH);

      return tryEncode(canvas);
    };

    const run = async (): Promise<{
      blob: Blob;
      name: string;
      mime: string;
    }> => {
      let encoded = null as { blob: Blob; ext: string; mime: string } | null;
      try {
        encoded = await downscaleAndEncode(file);
      } catch {
        encoded = null;
      }

      let finalBlob: Blob;
      let ext: string;
      let mime: string;

      if (!encoded) {
        finalBlob = file;
        ext = extOf(file.name) || 'bin';
        mime = file.type || 'application/octet-stream';
      } else {
        if (encoded.blob.size > file.size * largerFallbackFactor) {
          finalBlob = file;
          ext = extOf(file.name) || 'bin';
          mime = file.type || 'application/octet-stream';
        } else {
          finalBlob = encoded.blob;
          ext = encoded.ext;
          mime = encoded.mime;
        }
      }

      const base = slugBase(file.name);
      const suf = uniqueSuffix();
      const name = suf ? `${base}-${suf}.${ext}` : `${base}.${ext}`;

      return { blob: finalBlob, name, mime };
    };

    return from(run()).pipe(
      switchMap(({ blob, name, mime }) => {
        const bucket = this.supabase.storage.from('images');
        const fullPath = `${basePath.replace(/\/+$/, '')}/${name}`;
        return from(
          bucket.upload(fullPath, blob, { contentType: mime, upsert: true })
        ).pipe(
          map((res) => {
            if (res.error) throw new Error(res.error.message);
            return fullPath; 
          })
        );
      })
    );
  }
}
