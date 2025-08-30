import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, map, shareReplay } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { IMenu } from '../../interfaces/i-menu';
import {
  FOOTER_LEGAL_PATHS,
  GUEST_SIGNUP,
  MENU_BASE,
  SOCIAL_LINKS,
} from '../../config/menu.config';
// import { SupabaseService } from '../services/supabase/supabase.service'; // gdy podłączysz

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly auth = inject(AuthService);

  private readonly menuSource$ = new BehaviorSubject<IMenu[]>(MENU_BASE);

  readonly menu$: Observable<IMenu[]> = this.menuSource$.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly menu = toSignal(this.menu$, { initialValue: MENU_BASE });

  readonly navbarItems = computed<IMenu[]>(() => {
    const base = this.menu();
    const guest = !this.auth.user();
    return guest
      ? [...base, GUEST_SIGNUP]
      : base.filter((i) => i.path !== GUEST_SIGNUP.path);
  });

  private readonly indexByPath = computed<Map<string, IMenu>>(() => {
    const idx = new Map<string, IMenu>();
    const visit = (nodes: IMenu[]) => {
      for (const n of nodes) {
        if (n.path) idx.set(n.path, n);
        if (n.children?.length) visit(n.children);
      }
    };
    visit(this.menu());
    return idx;
  });

  // Sekcje footera – zwracamy *IMenu* z głównego drzewa (etykiety i path pochodzą z jednego miejsca)
  readonly footerShortcuts = computed<IMenu[]>(() => {
    const out: IMenu[] = [];
    const items = this.navbarItems();

    for (const i of items) {
      if (i.path && !i.disabled) out.push(i);
      if (i.children?.length) {
        for (const c of i.children) {
          if (c.path && !c.disabled) out.push(c);
        }
      }
    }
    return out;
  });

  readonly footerLegal = computed<IMenu[]>(() => {
    const idx = this.indexByPath();
    return FOOTER_LEGAL_PATHS.map((p) => idx.get(p)).filter(Boolean) as IMenu[];
  });

  readonly social = computed(() => SOCIAL_LINKS);
}
