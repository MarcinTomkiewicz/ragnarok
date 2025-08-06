import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ITeam } from '../../../core/interfaces/teams/i-team';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-card.component.html',
  styleUrl: './team-card.component.scss',
})
export class TeamCardComponent {
  team = input<ITeam>();
  showDetailsButton = input(false);

  showDetails = output<void>();

  onShowDetails(): void {
    this.showDetails.emit();
  }
}
