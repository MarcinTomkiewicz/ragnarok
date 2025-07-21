import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechStack } from '../../core/interfaces/i-techStack';
import { TeamService } from '../../core/services/team/team.service';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-meet-the-team',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meet-the-team.component.html',
  styleUrls: ['./meet-the-team.component.scss'],
})
export class MeetTheTeamComponent implements OnInit {
  team: TechStack[] = [];
  private readonly teamService = inject(TeamService);

  ngOnInit() {
    this.teamService.getCoreTeam().subscribe({
      next: (members) => {
        this.team = members.slice(0, 4);        
      },
      error: (err) => console.error('Błąd ładowania zespołu:', err),
    });
  }
}
