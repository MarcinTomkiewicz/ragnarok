import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BackendService,
  IPagination,
} from '../../../../core/services/backend/backend.service';
import { ITeam } from '../../../../core/interfaces/teams/i-team';
import { toSnakeCase } from '../../../../core/utils/type-mappers';
import {
  ITeamMember,
  TeamMemberRole,
} from '../../../../core/interfaces/teams/i-team-member';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { TeamRole } from '../../../../core/enums/team-role';
import { IFilter } from '../../../../core/interfaces/i-filters';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private backend = inject(BackendService);

  getTeams(
    pagination?: IPagination,
    sortBy?: keyof ITeam,
    sortOrder: 'asc' | 'desc' = 'asc',
    joins?: string
  ): Observable<ITeam[]> {
    return this.backend.getAll<ITeam>(
      'teams',
      sortBy,
      sortOrder,
      pagination,
      undefined,
      joins
    );
  }

  getTeamById(id: string): Observable<ITeam | null> {
    return this.backend.getById<ITeam>('teams', id);
  }

  createTeam(team: Partial<ITeam>): Observable<ITeam> {
    const data = toSnakeCase<ITeam>(team);
    return this.backend.create<ITeam>('teams', data);
  }

  updateTeam(id: string, team: Partial<ITeam>): Observable<ITeam> {
    const data = toSnakeCase<ITeam>(team);
    return this.backend.update<ITeam>('teams', id, data);
  }

  deleteTeam(id: string): Observable<void> {
    return this.backend.delete('teams', id);
  }

  getTeamMembers(
    teamId: string,
    filters?: { [key: string]: IFilter }
  ): Observable<ITeamMember[]> {
    const combinedFilters = {
      teamId: { operator: FilterOperator.EQ, value: teamId },
      ...filters,
    };
    return this.backend.getAll<ITeamMember>('team_members', undefined, 'asc', {
      filters: combinedFilters,
    });
  }

  getPendingRequests(teamId: string): Observable<ITeamMember[]> {
    const filters = {
      teamId: { operator: FilterOperator.EQ, value: teamId },
      status: { operator: FilterOperator.EQ, value: 'pending' }, // jeśli status istnieje w bazie
    };
    return this.backend.getAll<ITeamMember>('team_members', undefined, 'asc', {
      filters,
    });
  }

  requestToJoin(
    teamId: string,
    userId: string,
    role: TeamMemberRole = TeamRole.Player
  ): Observable<ITeamMember> {
    const data: Partial<ITeamMember> = {
      teamId,
      userId,
      role,
      joinedAt: new Date().toISOString(),
      leftAt: null,
    };
    return this.backend.create<ITeamMember>('team_members', toSnakeCase(data));
  }

  acceptRequest(requestId: string): Observable<ITeamMember> {
    // Zmiana np. statusu lub innego pola, jeśli status jest
    // W interfejsie brak status, więc może usunięcie pending po prostu oznacza joinedAt + brak leftAt
    return this.backend.update<ITeamMember>('team_members', requestId, {
      leftAt: null,
    });
  }

  rejectRequest(requestId: string): Observable<void> {
    // Tu można usunąć rekord lub ustawić leftAt na datę odrzucenia
    return this.backend
      .delete('team_members', requestId)
      .pipe
      // Jeśli chcemy zwrócić pustą odpowiedź
      // mapTo(null) lub podobne - zależy od potrzeb
      ();
  }

  getTeamsByUser(userId: string): Observable<ITeam[]> {
    return new Observable<ITeam[]>((subscriber) => {
      this.backend
        .getAll<ITeamMember>('team_members', undefined, 'asc', {
          filters: {
            userId: { operator: FilterOperator.EQ, value: userId },
            leftAt: { operator: FilterOperator.EQ, value: null }, // tylko aktywne członkostwa
          },
        })
        .subscribe({
          next: (members) => {
            if (!members.length) {
              subscriber.next([]);
              subscriber.complete();
              return;
            }
            const teamIds = members.map((m) => m.teamId);
            this.backend
              .getAll<ITeam>('teams', undefined, 'asc', {
                filters: {
                  id: { operator: FilterOperator.IN, value: teamIds },
                },
              })
              .subscribe({
                next: (teams) => {
                  subscriber.next(teams);
                  subscriber.complete();
                },
                error: (err) => subscriber.error(err),
              });
          },
          error: (err) => subscriber.error(err),
        });
    });
  }
}
