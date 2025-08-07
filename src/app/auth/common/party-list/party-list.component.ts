import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { IParty } from '../../../core/interfaces/teams/i-team';
import { PartyCardComponent } from '../party-card/party-card.component';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule, PartyCardComponent],
  templateUrl: './party-list.component.html',
  styleUrl: './party-list.component.scss',
})
export class PartyListComponent {
  teams = input<IParty[]>([]); 
  showDetailsButton = input(false); 

  showDetails = output<IParty>();

  onShowDetails(team: IParty): void {
    this.showDetails.emit(team);
  }
}
