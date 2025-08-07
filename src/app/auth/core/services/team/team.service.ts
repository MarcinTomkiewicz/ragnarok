import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, switchMap } from 'rxjs';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { GmStyleTag } from '../../../../core/enums/gm-styles';
import { TeamRole } from '../../../../core/enums/team-role';
import { IFilter } from '../../../../core/interfaces/i-filters';
import { IParty } from '../../../../core/interfaces/parties/i-party';
import {
  IPartyMember,
  TeamMemberRole,
} from '../../../../core/interfaces/parties/i-party-member';
import { IPartyProfile } from '../../../../core/interfaces/parties/i-party-profile';
import { IPartySystem } from '../../../../core/interfaces/parties/i-party-system';
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
    sortBy?: keyof IParty,
    sortOrder: 'asc' | 'desc' = 'asc',
    joins?: string
  ): Observable<IParty[]> {
    return this.backend.getAll<IParty>(
      'parties',
      sortBy,
      sortOrder,
      pagination,
      undefined,
      joins
    );
  }

  getTeamById(id: string): Observable<IParty | null> {
    return this.backend.getById<IParty>('parties', id);
  }

    getTeamOwnerData(ownerId: string): Observable<IUser | null> {
    return this.backend.getById<IUser>('users', ownerId);
  }

  CreateParty(
    team: IParty,
    systems: string[],
    styleTags: GmStyleTag[],
    description: string,
    members: IPartyMember[]
  ): Observable<IParty> {
    const data = toSnakeCase<IParty>(team); // Przekształcamy dane drużyny

    // Tworzymy drużynę (najpierw, aby uzyskać ID)
    return this.backend.create<IParty>('parties', data).pipe(
      switchMap(() => {
        // Po utworzeniu drużyny, wykonujemy zapytanie, aby uzyskać ID drużyny
        return this.backend
          .getOneByFields<IParty>('parties', { slug: team.slug })
          .pipe(
            switchMap((createdTeam) => {
              if (!createdTeam) {
                throw new Error('Błąd: nie udało się uzyskać ID drużyny');
              }

              // Tworzymy profil drużyny
              const profileData: IPartyProfile = {
                id: createdTeam.id, // ID stworzonej drużyny
                description: description,
                styleTags: styleTags,
                createdAt: new Date().toISOString(),
              };

              // Tworzymy profil drużyny
              return this.backend
                .create<IPartyProfile>('party_profiles', toSnakeCase(profileData))
                .pipe(
                  switchMap(() => {
                    // Tworzymy zapisy w tabeli team_systems - Zmieniamy na createMany
                    const systemRequests = systems.map((systemId) => ({
                      teamId: createdTeam.id,
                      systemId,
                    }));

                    return this.backend
                      .createMany<IPartySystem>(
                        'party_systems',
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

                          return this.backend.createMany<Partial<IPartyMember>>(
                            'party_members',
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

  updateTeam(id: string, team: Partial<IParty>): Observable<IParty> {
    const data = toSnakeCase<IParty>(team);
    return this.backend.update<IParty>('parties', id, data);
  }

  deleteTeam(id: string): Observable<void> {
    return this.backend.delete('parties', id);
  }

  getTeamMembers(
    teamId: string,
    filters?: { [key: string]: IFilter }
  ): Observable<IPartyMember[]> {
    const combinedFilters = {
      teamId: { operator: FilterOperator.EQ, value: teamId },
      ...filters,
    };
    return this.backend.getAll<IPartyMember>('party_members', undefined, 'asc', {
      filters: combinedFilters,
    });
  }

  getTeamSystems(teamId: string): Observable<IRPGSystem[]> {
    return this.backend
      .getAll<IPartySystem>('party_systems', 'teamId', 'asc', {
        filters: { teamId: { operator: FilterOperator.EQ, value: teamId } },
      })
      .pipe(
        switchMap((teamSystems) => {
          const systemIds = teamSystems.map((ts) => ts.systemId);
          return this.backend.getByIds<IRPGSystem>('systems', systemIds);
        })
      );
  }

  getTeamProfile(teamId: string): Observable<IPartyProfile | null> {
    return this.backend.getById<IPartyProfile>('party_profiles', teamId);
  }

  getPendingRequests(teamId: string): Observable<IPartyMember[]> {
    const filters = {
      teamId: { operator: FilterOperator.EQ, value: teamId },
      status: { operator: FilterOperator.EQ, value: 'pending' }, // jeśli status istnieje w bazie
    };
    return this.backend.getAll<IPartyMember>('party_members', undefined, 'asc', {
      filters,
    });
  }

  requestToJoin(
    teamId: string,
    userId: string,
    role: TeamMemberRole = TeamRole.Player
  ): Observable<IPartyMember> {
    const data: Partial<IPartyMember> = {
      teamId,
      userId,
      role,
      joinedAt: new Date().toISOString(),
      leftAt: null,
    };
    return this.backend.create<IPartyMember>('party_members', toSnakeCase(data));
  }

  acceptRequest(requestId: string): Observable<IPartyMember> {
    // Zmiana np. statusu lub innego pola, jeśli status jest
    // W interfejsie brak status, więc może usunięcie pending po prostu oznacza joinedAt + brak leftAt
    return this.backend.update<IPartyMember>('party_members', requestId, {
      leftAt: null,
    });
  }

  rejectRequest(requestId: string): Observable<void> {
    // Tu można usunąć rekord lub ustawić leftAt na datę odrzucenia
    return this.backend
      .delete('party_members', requestId)
      .pipe
      // Jeśli chcemy zwrócić pustą odpowiedź
      // mapTo(null) lub podobne - zależy od potrzeb
      ();
  }

  getTeamsByUser(userId: string): Observable<IParty[]> {
    return forkJoin([
      this.backend.getAll<IParty>('parties', 'name', 'asc', {
        filters: { ownerId: { operator: FilterOperator.EQ, value: userId } },
      }),
      this.backend.getAll<IPartyMember>('party_members', 'teamId', 'asc', {
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
