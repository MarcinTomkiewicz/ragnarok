import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { IUser } from '../../../../core/interfaces/i-user';
import { AuthService } from '../../../../core/services/auth/auth.service';

@Component({
  selector: 'app-party-members-picker',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './party-members-picker.component.html',
  styleUrl: './party-members-picker.component.scss',
})
export class PartyMembersPickerComponent {
  CoworkerRoles = CoworkerRoles;
  private auth = inject(AuthService);

  users = input.required<IUser[]>();
  selectedIds = input<string[]>([]);
  pending = input<{ id: string; userId: string }[]>([]);
  activeSet = input<Set<string>>(new Set());
  isClubParty = input(false);
  canShowEmails = input(false);
  showPending = input(false);

  selectedChange = output<string[]>();
  removeDbActive = output<string>(); // userId
  acceptPending = output<string>(); // memberLinkId
  rejectPending = output<string>(); // memberLinkId
  nonClubAttempt = output<void>();

  private term = signal('');

  filtered = computed(() => {
    const base0 = this.users();
    const base = this.isClubParty()
      ? base0.filter((u) => u.coworker === CoworkerRoles.Member)
      : base0;
    const t = this.term().trim().toLowerCase();
    return t.length >= 3
      ? base.filter((m) =>
          `${this.displayName(m)} ${m.email}`.toLowerCase().includes(t)
        )
      : base;
  });

  onSearch(ev: Event) {
    this.term.set((ev.target as HTMLInputElement).value ?? '');
  }

  isSelected(id: string) {
    return this.selectedIds().includes(id);
  }

  toggle(m: IUser) {
    if (this.isClubParty() && m.coworker !== CoworkerRoles.Member) {
      this.nonClubAttempt.emit();
      return;
    }
    const sel = this.selectedIds();
    const idx = sel.indexOf(m.id);
    if (idx >= 0) {
      const next = sel.filter((x) => x !== m.id);
      this.selectedChange.emit(next);
      return;
    }
    if (sel.length >= 5) return;
    this.selectedChange.emit([...sel, m.id]);
  }

  remove(id: string, isDbActive: boolean) {
    const next = this.selectedIds().filter((x) => x !== id);
    this.selectedChange.emit(next);
    if (isDbActive) this.removeDbActive.emit(id);
  }

  accept(id: string) {
    if (this.selectedIds().length >= 5) return;
    this.acceptPending.emit(id);
  }
  reject(id: string) {
    this.rejectPending.emit(id);
  }

  displayName(u: IUser | null) {
    return this.auth.userDisplayName(u);
  }

  shouldShowEmailForActive(userId: string): boolean {
    return (
      this.canShowEmails() &&
      this.activeSet().has(userId) &&
      !!this.emailById(userId)
    );
  }

  nameById(id: string): string {
    const u =
      this.users().find((x) => x.id === id) ??
      (this.auth.user()?.id === id ? this.auth.user()! : null);
    return u ? this.displayName(u) : id;
  }

  emailById(id: string): string {
    const u =
      this.users().find((x) => x.id === id) ??
      (this.auth.user()?.id === id ? this.auth.user()! : null);
    return u?.email ?? '';
  }

  hasBadge(id: string, type: 'member' | 'golden'): boolean {
    const u = this.users().find((x) => x.id === id);
    return type === 'member'
      ? u?.coworker === CoworkerRoles.Member
      : u?.coworker === CoworkerRoles.Golden;
  }
  
  badgeByUserId(id: string): 'member' | 'golden' | null {
    const u = this.users().find((x) => x.id === id);
    if (u?.coworker === CoworkerRoles.Member) return 'member';
    if (u?.coworker === CoworkerRoles.Golden) return 'golden';
    return null;
  }
}
