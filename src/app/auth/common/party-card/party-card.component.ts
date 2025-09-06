import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  WritableSignal,
} from '@angular/core';
import { IParty } from '../../../core/interfaces/parties/i-party';
import { forkJoin } from 'rxjs';
import { PartyService } from '../../core/services/party/party.service';
import { IPartyMember } from '../../../core/interfaces/parties/i-party-member';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { IPartyProfile } from '../../../core/interfaces/parties/i-party-profile';
import { IUser } from '../../../core/interfaces/i-user';
import { GmStyleTag, GmStyleTagLabels } from '../../../core/enums/gm-styles';
import { AuthService } from '../../../core/services/auth/auth.service';
import { TeamRole, TeamRoleLabels } from '../../../core/enums/party.enum';
import { PartyMemberStatus } from '../../../core/enums/party.enum';

@Component({
  selector: 'app-party-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './party-card.component.html',
  styleUrl: './party-card.component.scss',
})
export class PartyCardComponent {
  private readonly partyService = inject(PartyService);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  team = input.required<IParty>({});
  showDetailsButton = input(false);

  public readonly GmStyleTagLabels = GmStyleTagLabels;
  public readonly TeamRole = TeamRole;
  public readonly TeamRoleLabels = TeamRoleLabels;

  public showStyle = computed(() => {
    const profile = this.profile();
    return profile && profile.styleTags && profile.styleTags.length > 0;
  });

  members: WritableSignal<IPartyMember[]> = signal<IPartyMember[]>([]);
  systems: WritableSignal<IRPGSystem[]> = signal<IRPGSystem[]>([]);
  profile: WritableSignal<IPartyProfile | null> = signal<IPartyProfile | null>(null);
  owner: WritableSignal<IUser | null> = signal<IUser | null>(null);

  /** Pending: linki + dane userów do „awatarów” */
  pendingMembers = computed(() =>
    this.members().filter(m => m.memberStatus === PartyMemberStatus.Pending && !m.leftAt)
  );
  pendingCount = computed(() => this.pendingMembers().length);
  pendingUserIds = computed(() => Array.from(new Set(this.pendingMembers().map(m => m.userId))));
  pendingUsers: WritableSignal<IUser[]> = signal<IUser[]>([]);
  pendingUsersPreview = computed(() => this.pendingUsers().slice(0, 5));
  pendingOverflow = computed(() => Math.max(0, this.pendingCount() - this.pendingUsersPreview().length));

  /** Czy ja mogę moderować (właściciel lub MG tej drużyny) */
  canModerate = computed<boolean>(() => {
    const me = this.user()?.id ?? null;
    if (!me) return false;
    const t = this.team();
    return t.ownerId === me || t.gmId === me;
  });

  showDetails = output<void>();
  editParty = output<void>();

  get ownerDisplayName(): string {
    return this.auth.userDisplayName(this.owner());
  }

  readonly myRole = computed<TeamRole>(() => {
    const me = this.user()?.id ?? null;
    if (!me) return TeamRole.None;

    const t = this.team();
    if (t.ownerId === me) return TeamRole.Owner;
    if (t.gmId === me) return TeamRole.Gm;

    const m = this.members().find(x => x.userId === me);
    return (m?.role as unknown as TeamRole) ?? TeamRole.None;
  });

  ngOnInit(): void {
    forkJoin([
      this.partyService.getPartyMembers(this.team().id),
      this.partyService.getPartySystems(this.team().id),
      this.partyService.getPartyProfile(this.team().id),
      this.partyService.getPartyOwnerData(this.team().ownerId),
    ]).subscribe({
      next: ([members, systems, profile, owner]) => {
        this.members.set(members);
        this.systems.set(systems);
        this.profile.set(profile);
        this.owner.set(owner);

        // po wczytaniu członków — dociągnij dane użytkowników dla pendingów (do inicjałów + title)
        this.loadPendingUsers();
      },
    });
  }

  private loadPendingUsers(): void {
    const ids = this.pendingUserIds();
    if (!ids.length) {
      this.pendingUsers.set([]);
      return;
    }
    this.partyService.getUsersByIds(ids).subscribe(users => {
      // zachowaj kolejność według members() (opcjonalne)
      const order = new Map(ids.map((id, idx) => [id, idx]));
      const sorted = [...users].sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
      this.pendingUsers.set(sorted);
    });
  }

  onShowDetails(): void {
    this.showDetails.emit();
  }

  onEditParty(): void {
    this.editParty.emit();
  }

  canEditParty(): boolean {
    return this.user()?.id === this.owner()?.id;
  }

  /** Helpers: wyświetlanie */
  userDisplayName(u: IUser | null): string {
    return this.auth.userDisplayName(u);
  }

  initials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  trackTag(index: number, tag: string): string {
    return tag;
  }

  trackSystem(index: number, system: IRPGSystem): string {
    return system.id;
  }

  trackUser(index: number, u: IUser): string {
    return u.id;
  }
}
