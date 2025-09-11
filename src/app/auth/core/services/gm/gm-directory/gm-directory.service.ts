import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BackendService } from '../../../../../core/services/backend/backend.service';
import { IGmData } from '../../../../../core/interfaces/i-gm-profile';
import { FilterOperator } from '../../../../../core/enums/filterOperator';
import { IUser } from '../../../../../core/interfaces/i-user';
import { IRPGSystem } from '../../../../../core/interfaces/i-rpg-system';


@Injectable({ providedIn: 'root' })
export class GmDirectoryService {
  private readonly backend = inject(BackendService);

  getAllGms(): Observable<IGmData[]> {
    return this.backend.getAll<IGmData>('v_gm_basic_info');
  }

  getGmById(gmId: string | null): Observable<IGmData | null> {
    if (!gmId) return of(null);
    return this.backend
      .getAll<IGmData>('v_gm_basic_info', undefined, 'asc', {
        filters: { userId: { value: gmId, operator: FilterOperator.EQ } },
      })
      .pipe(
        map((rows) => rows?.[0] ?? null),
        switchMap((row) => {
          if (row) return of(this.fillGmDefaults(row));
          return this.backend
            .getById<IUser>('users', gmId)
            .pipe(map((u) => (u ? this.fromUserToMinimalGm(u) : null)));
        })
      );
  }

  getSystemsForGm(gmId: string): Observable<IRPGSystem[]> {
    return this.backend
      .getAll<Pick<IGmData, 'systemId'>>('v_gm_specialties_with_user', undefined, 'asc', {
        filters: { userId: { value: gmId, operator: FilterOperator.EQ } },
      })
      .pipe(
        map((rows) => Array.from(new Set(rows.map((r) => r.systemId))).filter(Boolean)),
        switchMap((ids) => (ids.length ? this.backend.getByIds<IRPGSystem>('systems', ids) : of([])))
      );
  }

  getGmsForSystem(systemId: string): Observable<IGmData[]> {
    return this.backend.getAll<IGmData>('v_gm_specialties_with_user', undefined, 'asc', {
      filters: { systemId: { value: systemId, operator: FilterOperator.EQ } },
    });
  }

  getSystemsWithAtLeastOneGm(): Observable<IRPGSystem[]> {
    return this.backend
      .getAll<Pick<IGmData, 'systemId'>>('v_gm_specialties_with_user')
      .pipe(
        map((rows) => Array.from(new Set(rows.map((r) => r.systemId).filter(Boolean)))),
        switchMap((ids) => (ids.length ? this.backend.getByIds<IRPGSystem>('systems', ids) : of([])))
      );
  }

  readonly gmDisplayName = (gm: IGmData | null): string => {
    if (!gm) return '';
    return gm.useNickname && gm.nickname ? gm.nickname : gm.firstName ?? '';
  };

  formatPl(dateYmd: string): string {
    const [y, m, d] = dateYmd.split('-');
    return `${d}.${m}.${y}`;
  }

  private fillGmDefaults(g: IGmData): IGmData {
    return {
      gmProfileId: g.gmProfileId ?? '',
      userId: g.userId,
      firstName: g.firstName ?? '',
      nickname: g.nickname ?? '',
      age: g.age ?? null,
      shortDescription: g.shortDescription ?? null,
      experience: g.experience ?? null,
      image: g.image ?? null,
      quote: g.quote ?? null,
      styleTags: g.styleTags ?? [],
      systemId: g.systemId ?? '',
      gmProfileCreatedAt: g.gmProfileCreatedAt ?? new Date(0),
      useNickname: !!g.useNickname,
    };
  }

  private fromUserToMinimalGm(u: IUser): IGmData {
    return {
      gmProfileId: '',
      userId: u.id,
      firstName: u.firstName ?? '',
      nickname: u.nickname ?? '',
      age: null,
      shortDescription: null,
      experience: null,
      image: null,
      quote: null,
      styleTags: [],
      systemId: '',
      gmProfileCreatedAt: new Date(0),
      useNickname: !!u.useNickname,
    };
  }

  updateSpecialties(gmId: string, systemIds: string[]): Observable<void> {
    const table = 'gm_specialties';
    const delete$ = this.backend.delete(table, { gm_id: { value: gmId, operator: FilterOperator.EQ } });
    const insertPayload = systemIds.map((systemId) => ({ gmId, systemId }));
    const insert$ = systemIds.length ? this.backend.createMany(table, insertPayload as any) : of([]);
    return delete$.pipe(switchMap(() => insert$), map(() => {}));
  }
}
