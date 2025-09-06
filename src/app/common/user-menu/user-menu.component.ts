import { Component, effect, inject, HostListener, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../../auth/components/login/login.component';
import { AuthService } from '../../core/services/auth/auth.service';
import { IUser } from '../../core/interfaces/i-user';
import { UserMenuPanelComponent } from '../../auth/common/user-menu-panel/user-menu-panel.component';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, distinctUntilChanged, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { PartyService } from '../../auth/core/services/party/party.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, LoginComponent, UserMenuPanelComponent],
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent {
  isOpen = false;
  pendingCount = 0;

  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly partyService = inject(PartyService);
  private prevUser: IUser | null = null;

  constructor() {
    // Zamknij dropdown, gdy użytkownik się właśnie zalogował
    effect(() => {
      const current = this.auth.user();
      if (!this.prevUser && current && this.isOpen) this.isOpen = false;
      this.prevUser = current;
    });

    // Live-licznik: reaguje na zmianę użytkownika
    toObservable(this.auth.user)
      .pipe(
        map(u => u?.id ?? null),
        distinctUntilChanged(),
        switchMap(userId =>
          userId ? this.partyService.getPendingDecisionCountForUser(userId) : of(0)
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: cnt => (this.pendingCount = cnt ?? 0),
        error: () => (this.pendingCount = 0),
      });
  }

  /** Dodatkowy refresh np. przy otwieraniu menu (po akcjach w panelu). */
  private refreshPendingCount(): void {
    const userId = this.auth.user()?.id;
    if (!userId) { this.pendingCount = 0; return; }
    this.partyService.getPendingDecisionCountForUser(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cnt => (this.pendingCount = cnt ?? 0),
        error: () => (this.pendingCount = 0),
      });
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.refreshPendingCount(); // dobij aktualny stan
  }

  pendingCountLabel(): string {
    const n = this.pendingCount || 0;
    return n > 99 ? '99+' : String(n);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) this.isOpen = false;
  }
}
