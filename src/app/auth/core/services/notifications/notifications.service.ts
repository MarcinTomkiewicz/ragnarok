// core/services/notification/notification.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, switchMap, startWith } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { NotificationBucket } from '../../../../core/enums/notification-bucket';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { PartyService } from '../party/party.service';

type BucketSource = [NotificationBucket, Observable<number>];

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly party = inject(PartyService);

  private readonly userId$ = toObservable(this.auth.user).pipe(
    map(u => u?.id ?? null),
    distinctUntilChanged()
  );

  private readonly sources$ = new BehaviorSubject<BucketSource[]>([]);

  constructor() {
    const partyPending$ = this.userId$.pipe(
      switchMap(id => id ? this.party.getPendingDecisionCountForUser(id) : of(0)),
      startWith(0),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.register(NotificationBucket.PartyMembershipRequests, partyPending$);
  }

  register(bucket: NotificationBucket, source$: Observable<number>): void {
    const wrapped$ = source$.pipe(
      startWith(0),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    const curr = this.sources$.value.filter(([b]) => b !== bucket);
    this.sources$.next([...curr, [bucket, wrapped$]]);
  }

  count$(bucket: NotificationBucket): Observable<number> {
    return this.sources$.pipe(
      map(arr => arr.find(([b]) => b === bucket)?.[1] ?? of(0)),
      switchMap(obs$ => obs$)
    );
  }

  readonly total$: Observable<number> = this.sources$.pipe(
    switchMap(arr => arr.length ? combineLatest(arr.map(([, s$]) => s$)) : of([0])),
    map(values => values.reduce((sum, v) => sum + (v ?? 0), 0)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // 👉 NOWE: pełna mapa liczników
  readonly counts$: Observable<Record<NotificationBucket, number>> = this.sources$.pipe(
    switchMap(arr => {
      if (!arr.length) return of({} as Record<NotificationBucket, number>);
      const keys = arr.map(([b]) => b);
      return combineLatest(arr.map(([, s$]) => s$)).pipe(
        map(values => {
          const out = {} as Record<NotificationBucket, number>;
          values.forEach((v, i) => (out[keys[i]] = v ?? 0));
          return out;
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}
