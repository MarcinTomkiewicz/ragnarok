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
import { TeamRole, TeamRoleLabels } from '../../../core/enums/team-role';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './party-card.component.html',
  styleUrl: './party-card.component.scss',
})
export class PartyCardComponent {
  private readonly PartyService = inject(PartyService);

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

  ngOnInit(): void {
    forkJoin([
      this.PartyService.getPartyMembers(this.team().id),
      this.PartyService.getPartySystems(this.team().id),
      this.PartyService.getPartyProfile(this.team().id),
      this.PartyService.getPartyOwnerData(this.team().ownerId),
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

  trackTag(index: number, tag: string): string {
    return tag; // track by tag value (or any unique property)
  }

  trackSystem(index: number, system: IRPGSystem): string {
    return system.id; // track by system id (or any unique property)
  }
}
