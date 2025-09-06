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
  profile: WritableSignal<IPartyProfile | null> = signal<IPartyProfile | null>(
    null
  );
  owner: WritableSignal<IUser | null> = signal<IUser | null>(null);

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
      },
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

  trackTag(index: number, tag: string): string {
    return tag; 
  }

  trackSystem(index: number, system: IRPGSystem): string {
    return system.id;
  }
}
