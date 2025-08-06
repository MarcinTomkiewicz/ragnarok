import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ITeam } from '../../../core/interfaces/teams/i-team';
import { TeamCardComponent } from '../team-card/team-card.component';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule, TeamCardComponent],
  templateUrl: './team-list.component.html',
  styleUrl: './team-list.component.scss',
})
export class TeamListComponent {
  teams = input<ITeam[]>([]); 
  showDetailsButton = input(false); 

  showDetails = output<ITeam>();

  onShowDetails(team: ITeam): void {
    this.showDetails.emit(team);
  }
}
