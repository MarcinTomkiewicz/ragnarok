import { computed, signal, Signal } from '@angular/core';
import { Observable, of, Subscription } from 'rxjs';

/**
 * Reaktywne computed, które wspiera zwracanie obserwabli
 * i aktualizuje sygnał na podstawie ich wyników.
 */
export function rxComputed<T>(
  deps: Signal<unknown>[],
  observableFactory: (...values: any[]) => Observable<T>
): Signal<T> {
  const state = signal<T>(undefined as any); // SSR-safe
  let sub: Subscription | null = null;

  computed(() => {
    const values = deps.map((d) => d());
    sub?.unsubscribe();
    sub = observableFactory(...values).subscribe((v) => state.set(v));
  });

  return state.asReadonly();
}
