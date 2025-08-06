import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, switchMap } from 'rxjs';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { GmStyleTag } from '../../../../core/enums/gm-styles';
import { TeamRole } from '../../../../core/enums/team-role';
import { IFilter } from '../../../../core/interfaces/i-filters';
import { ITeam } from '../../../../core/interfaces/teams/i-team';
import {
  ITeamMember,
  TeamMemberRole,
} from '../../../../core/interfaces/teams/i-team-member';
import { ITeamProfile } from '../../../../core/interfaces/teams/i-team-profile';
import { ITeamSystem } from '../../../../core/interfaces/teams/i-team-system';
import {
  BackendService,
  IPagination,
} from '../../../../core/services/backend/backend.service';
import { toSnakeCase } from '../../../../core/utils/type-mappers';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IUser } from '../../../../core/interfaces/i-user';

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

    getTeamOwnerData(ownerId: string): Observable<IUser | null> {
    return this.backend.getById<IUser>('users', ownerId);
  }

  createTeam(
    team: ITeam,
    systems: string[],
    styleTags: GmStyleTag[],
    description: string,
    members: ITeamMember[]
  ): Observable<ITeam> {
    const data = toSnakeCase<ITeam>(team); // Przekształcamy dane drużyny

    // Tworzymy drużynę (najpierw, aby uzyskać ID)
    return this.backend.create<ITeam>('teams', data).pipe(
      switchMap(() => {
        // Po utworzeniu drużyny, wykonujemy zapytanie, aby uzyskać ID drużyny
        return this.backend
          .getOneByFields<ITeam>('teams', { slug: team.slug })
          .pipe(
            switchMap((createdTeam) => {
              if (!createdTeam) {
                throw new Error('Błąd: nie udało się uzyskać ID drużyny');
              }

              // Tworzymy profil drużyny
              const profileData: ITeamProfile = {
                id: createdTeam.id, // ID stworzonej drużyny
                description: description,
                styleTags: styleTags,
                createdAt: new Date().toISOString(),
              };

              // Tworzymy profil drużyny
              return this.backend
                .create<ITeamProfile>('team_profiles', toSnakeCase(profileData))
                .pipe(
                  switchMap(() => {
                    // Tworzymy zapisy w tabeli team_systems - Zmieniamy na createMany
                    const systemRequests = systems.map((systemId) => ({
                      teamId: createdTeam.id,
                      systemId,
                    }));

                    return this.backend
                      .createMany<ITeamSystem>(
                        'team_systems',
                        toSnakeCase(systemRequests)
                      )
                      .pipe(
                        switchMap(() => {
                          // Tworzymy zapisy członków drużyny - Zmieniamy na createMany
                          const memberRequests = members.map((member) => ({
                            teamId: createdTeam.id,
                            userId: member.userId,
                            role: member.role,
                            joinedAt: new Date().toISOString(),
                            leftAt: null,
                          }));

                          return this.backend.createMany<Partial<ITeamMember>>(
                            'team_members',
                            toSnakeCase(memberRequests)
                          );
                        }),
                        map(() => createdTeam) // Zwracamy stworzoną drużynę po wykonaniu wszystkich operacji
                      );
                  })
                );
            })
          );
      })
    );
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

  getTeamSystems(teamId: string): Observable<IRPGSystem[]> {
    return this.backend
      .getAll<ITeamSystem>('team_systems', 'teamId', 'asc', {
        filters: { teamId: { operator: FilterOperator.EQ, value: teamId } },
      })
      .pipe(
        switchMap((teamSystems) => {
          const systemIds = teamSystems.map((ts) => ts.systemId);
          return this.backend.getByIds<IRPGSystem>('systems', systemIds);
        })
      );
  }

  getTeamProfile(teamId: string): Observable<ITeamProfile | null> {
    return this.backend.getById<ITeamProfile>('team_profiles', teamId);
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
    return forkJoin([
      this.backend.getAll<ITeam>('teams', 'name', 'asc', {
        filters: { ownerId: { operator: FilterOperator.EQ, value: userId } },
      }),
      this.backend.getAll<ITeamMember>('team_members', 'teamId', 'asc', {
        filters: { userId: { operator: FilterOperator.EQ, value: userId } },
      }),
    ]).pipe(
      map(([ownedTeams, memberTeams]) => {
        const memberTeamIds = memberTeams.map((member) => member.teamId);
        return [
          ...ownedTeams,
          ...ownedTeams.filter((team) => memberTeamIds.includes(team.id)),
        ];
      })
    );
  }
}
