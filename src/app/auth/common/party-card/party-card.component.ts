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
import { ITeam } from '../../../core/interfaces/teams/i-team';
import { forkJoin } from 'rxjs';
import { TeamService } from '../../core/services/team/team.service';
import { ITeamMember } from '../../../core/interfaces/teams/i-team-member';
import { IRPGSystem } from '../../../core/interfaces/i-rpg-system';
import { ITeamProfile } from '../../../core/interfaces/teams/i-team-profile';
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
  private readonly teamService = inject(TeamService);

  team = input.required<ITeam>({});
  showDetailsButton = input(false);

  public readonly GmStyleTagLabels = GmStyleTagLabels;
  public readonly TeamRole = TeamRole;
  public readonly TeamRoleLabels = TeamRoleLabels;
  public showStyle = computed(() => {
    const profile = this.profile();
    return profile && profile.styleTags && profile.styleTags.length > 0;
  });

  members: WritableSignal<ITeamMember[]> = signal<ITeamMember[]>([]);
  systems: WritableSignal<IRPGSystem[]> = signal<IRPGSystem[]>([]);
  profile: WritableSignal<ITeamProfile | null> = signal<ITeamProfile | null>(
    null
  );
  owner: WritableSignal<IUser | null> = signal<IUser | null>(null);

  showDetails = output<void>();

  ngOnInit(): void {
    forkJoin([
      this.teamService.getTeamMembers(this.team().id),
      this.teamService.getTeamSystems(this.team().id),
      this.teamService.getTeamProfile(this.team().id),
      this.teamService.getTeamOwnerData(this.team().ownerId),
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
