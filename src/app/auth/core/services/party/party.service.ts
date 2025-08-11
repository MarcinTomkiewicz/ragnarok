import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { GmStyleTag } from '../../../../core/enums/gm-styles';
import { TeamRole } from '../../../../core/enums/team-role';
import { IFilter } from '../../../../core/interfaces/i-filters';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IUser } from '../../../../core/interfaces/i-user';
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
import e from 'express';

@Injectable({ providedIn: 'root' })
export class PartyService {
  private backend = inject(BackendService);

  getParties(
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

  getPartyById(id: string): Observable<IParty | null> {
    return this.backend.getById<IParty>('parties', id);
  }

  getPartyBySlug(slug: string): Observable<IParty | null> {
    return this.backend.getBySlug<IParty>('parties', slug);
  }

  getPartyOwnerData(ownerId: string): Observable<IUser | null> {
    return this.backend.getById<IUser>('users', ownerId);
  }

  getUserParties(userId: string): Observable<IParty[]> {
    return forkJoin([
      this.backend.getAll<IParty>('parties', 'name', 'asc', {
        filters: { ownerId: { operator: FilterOperator.EQ, value: userId } },
      }),
      this.backend.getAll<IPartyMember>('party_members', 'teamId', 'asc', {
        filters: { userId: { operator: FilterOperator.EQ, value: userId } },
      }),
    ]).pipe(
      switchMap(([ownedTeams, memberTeams]) => {
        const memberTeamIds = memberTeams.map((member) => member.teamId);
        if (memberTeamIds.length === 0) {
          return of(ownedTeams);
        }

        return this.backend
          .getAll<IParty>('parties', 'name', 'asc', {
            filters: {
              id: { operator: FilterOperator.IN, value: memberTeamIds },
            },
          })
          .pipe(
            map((memberParties) => {
              return [...ownedTeams, ...memberParties];
            })
          );
      })
    );
  }

  createOrUpdateParty(
    team: IParty,
    systems: string[],
    styleTags: GmStyleTag[],
    description: string,
    members: string[]
  ): Observable<IParty> {
    const teamData = toSnakeCase<IParty>(team);

    return this.backend.upsert<IParty>('parties', teamData, 'slug').pipe(
      switchMap(() => {
        return this.backend
          .getOneByFields<IParty>('parties', { slug: team.slug })
          .pipe(
            switchMap((updatedTeam) => {
              if (!updatedTeam) {
                throw new Error(
                  'Błąd: nie udało się uzyskać zaktualizowanej drużyny'
                );
              }

              const profileData: IPartyProfile = {
                id: updatedTeam.id,
                description: description,
                styleTags: styleTags,
                createdAt: new Date().toISOString(),
              };

              return this.backend
                .upsert<IPartyProfile>(
                  'party_profiles',
                  toSnakeCase(profileData),
                  'id'
                )
                .pipe(
                  switchMap(() => {
                    const systemRequests = systems.map((systemId) => ({
                      teamId: updatedTeam.id,
                      systemId,
                    }));

                    return this.removeDeletedSystems(
                      updatedTeam.id,
                      systems
                    ).pipe(
                      switchMap(() => {
                        return this.backend.upsertMany<IPartySystem>(
                          'party_systems',
                          toSnakeCase(systemRequests),
                          'team_id, system_id'
                        );
                      }),
                      switchMap(() => {
                        return this.removeDeletedMembers(
                          updatedTeam.id,
                          members
                        ).pipe(
                          switchMap(() => {
                            const memberRequests = members.map((member) => ({
                              teamId: updatedTeam.id,
                              userId: member,
                              role: null,
                              joinedAt: new Date().toISOString(),
                              leftAt: null,
                            }));

                            return this.backend.upsertMany<IPartyMember>(
                              'party_members',
                              toSnakeCase(memberRequests),
                              'team_id,user_id'
                            );
                          })
                        );
                      })
                    );
                  }),
                  map(() => updatedTeam)
                );
            })
          );
      })
    );
  }

  private removeDeletedSystems(
    teamId: string,
    systems: string[]
  ): Observable<void> {
    return this.backend
      .getAll<IPartySystem>('party_systems', 'teamId', 'asc', {
        filters: { teamId: { operator: FilterOperator.EQ, value: teamId } },
      })
      .pipe(
        switchMap((existingSystems) => {
          const existingSystemIds = existingSystems.map(
            (system) => system.systemId
          );
          const systemsToDelete = existingSystemIds.filter(
            (id) => !systems.includes(id)
          );

          if (systemsToDelete.length > 0) {
            return forkJoin(
              systemsToDelete.map((systemId) =>
                this.backend.delete('party_systems', {
                  teamId: { value: teamId, operator: FilterOperator.EQ },
                  systemId: { value: systemId, operator: FilterOperator.EQ },
                })
              )
            ).pipe(map(() => {}));
          }
          return of(undefined);
        })
      );
  }

  private removeDeletedMembers(
    teamId: string,
    members: string[]
  ): Observable<void> {
    return this.backend
      .getAll<IPartyMember>('party_members', 'teamId', 'asc', {
        filters: { teamId: { operator: FilterOperator.EQ, value: teamId } },
      })
      .pipe(
        switchMap((existingMembers) => {
          const existingMemberIds = existingMembers.map(
            (member) => member.userId
          );
          const membersToDelete = existingMemberIds.filter(
            (id) => !members.includes(id)
          );

          if (membersToDelete.length > 0) {
            return forkJoin(
              membersToDelete.map((userId) =>
                this.backend.delete('party_members', {
                  teamId: { value: teamId, operator: FilterOperator.EQ },
                  userId: { value: userId, operator: FilterOperator.EQ },
                })
              )
            ).pipe(map(() => {}));
          }
          return of(undefined);
        })
      );
  }

  deleteParty(id: string): Observable<void> {
    return this.backend.delete('parties', id);
  }

  getPartyMembers(
    teamId: string,
    filters?: { [key: string]: IFilter }
  ): Observable<IPartyMember[]> {
    const combinedFilters = {
      teamId: { operator: FilterOperator.EQ, value: teamId },
      ...filters,
    };
    return this.backend.getAll<IPartyMember>(
      'party_members',
      undefined,
      'asc',
      {
        filters: combinedFilters,
      }
    );
  }

  getPartySystems(teamId: string): Observable<IRPGSystem[]> {
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

  getPartyProfile(teamId: string): Observable<IPartyProfile | null> {
    return this.backend.getById<IPartyProfile>('party_profiles', teamId);
  }

  getPendingRequests(teamId: string): Observable<IPartyMember[]> {
    const filters = {
      teamId: { operator: FilterOperator.EQ, value: teamId },
      status: { operator: FilterOperator.EQ, value: 'pending' }, // jeśli status istnieje w bazie
    };
    return this.backend.getAll<IPartyMember>(
      'party_members',
      undefined,
      'asc',
      {
        filters,
      }
    );
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
    return this.backend.create<IPartyMember>(
      'party_members',
      toSnakeCase(data)
    );
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

getPartiesByUser(userId: string): Observable<IParty[]> {
  return forkJoin([
    this.backend.getAll<IParty>('parties', 'name', 'asc', {
      filters: { ownerId: { operator: FilterOperator.EQ, value: userId } },
    }),
    this.backend.getAll<IPartyMember>('party_members', 'teamId', 'asc', {
      filters: { userId: { operator: FilterOperator.EQ, value: userId } },
    }),
  ]).pipe(
    switchMap(([ownedTeams, memberTeams]) => {
      const memberTeamIds = memberTeams.map(m => m.teamId);

      if (!memberTeamIds.length) {
        return of(ownedTeams);
      }

      return this.backend.getAll<IParty>('parties', 'name', 'asc', {
        filters: {
          id: { operator: FilterOperator.IN, value: memberTeamIds },
        },
      }).pipe(
        map(memberParties => {
          const all = [...ownedTeams, ...memberParties];
          const uniq = Array.from(new Map(all.map(p => [p.id, p])).values());
          return uniq;
        })
      );
    })
  );
}

}
