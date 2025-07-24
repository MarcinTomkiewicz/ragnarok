// core/services/team/team.service.ts
import { Injectable } from '@angular/core';
import { BackendService } from '../backend/backend.service';
import { Observable, map } from 'rxjs';
import { TechStack } from '../../interfaces/i-techStack';
import { CoworkerRoles } from '../../enums/roles';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  constructor(private backendService: BackendService) {}

  getCoreTeam(): Observable<TechStack[]> {
    return this.backendService.getAll<TechStack>(
      'tech_stack',
      'id',
      'asc',
      undefined,
      { width: 234, height: 234 }
    ).pipe(
      map((data) =>
        data.filter((member) => member.isActive && member.role !== CoworkerRoles.Gm)
      )
    );
  }
}
