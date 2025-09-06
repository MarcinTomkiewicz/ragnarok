import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { GmStyleTag } from '../../../../core/enums/gm-styles';
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
import { PartyType, TeamRole } from '../../../../core/enums/party.enum';
import { CoworkerRoles } from '../../../../core/enums/roles';

@Injectable({ providedIn: 'root' })
export class PartyService {
  private backend = inject(BackendService);

  // ===== Read =====
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

  getOpenParties(
    sortBy: keyof IParty = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Observable<IParty[]> {
    return this.backend.getAll<IParty>('parties', sortBy, sortOrder, {
      filters: { isOpen: { operator: FilterOperator.EQ, value: true } },
    });
  }

  getPartyOwnerData(ownerId: string): Observable<IUser | null> {
    return this.backend.getById<IUser>('users', ownerId);
  }

  getUsersByIds(ids: string[]) {
    return this.backend.getByIds<IUser>('users', ids);
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

  getPartiesOwnedBy(userId: string): Observable<IParty[]> {
    return this.backend.getAll<IParty>('parties', 'name', 'asc', {
      filters: { ownerId: { operator: FilterOperator.EQ, value: userId } },
    });
  }

  getPartiesWhereGm(userId: string): Observable<IParty[]> {
    return this.backend.getAll<IParty>('parties', 'name', 'asc', {
      filters: { gmId: { operator: FilterOperator.EQ, value: userId } },
    });
  }

  getPartiesWhereMember(userId: string): Observable<IParty[]> {
    return this.backend
      .getAll<IPartyMember>('party_members', 'teamId', 'asc', {
        filters: { userId: { operator: FilterOperator.EQ, value: userId } },
      })
      .pipe(
        switchMap((links) => {
          const teamIds = links.map((m) => m.teamId);
          if (!teamIds.length) return of<IParty[]>([]);
          return this.backend.getAll<IParty>('parties', 'name', 'asc', {
            filters: { id: { operator: FilterOperator.IN, value: teamIds } },
          });
        })
      );
  }

  // ===== Write / Update =====
  createOrUpdateParty(
    team: IParty,
    systems: string[],
    styleTags: GmStyleTag[],
    description: string,
    members: string[]
  ): Observable<IParty> {
    const teamData = toSnakeCase<IParty>(team);

    return this.backend.upsert<IParty>('parties', teamData, 'slug').pipe(
      switchMap(() =>
        this.backend.getOneByFields<IParty>('parties', { slug: team.slug })
      ),
      switchMap((updatedTeam) => {
        if (!updatedTeam) {
          throw new Error(
            'Błąd: nie udało się uzyskać zaktualizowanej drużyny'
          );
        }

        const profileData: IPartyProfile = {
          id: updatedTeam.id,
          description,
          styleTags,
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
              const systemRequests = (systems ?? []).map((systemId) => ({
                teamId: updatedTeam.id,
                systemId,
              }));

              return this.removeDeletedSystems(updatedTeam.id, systems).pipe(
                switchMap(() =>
                  this.backend.upsertMany<IPartySystem>(
                    'party_systems',
                    toSnakeCase(systemRequests),
                    'team_id, system_id'
                  )
                )
              );
            }),
            switchMap(() => {
              const ownerId = updatedTeam.ownerId ?? null;
              const gmId = updatedTeam.gmId ?? null;

              const uniqueMembers = Array.from(
                new Set((members ?? []).filter(Boolean))
              ) as string[];

              const memberRequests = uniqueMembers.map((userId) => ({
                teamId: updatedTeam.id,
                userId,
                role:
                  userId === ownerId
                    ? TeamRole.Owner
                    : userId === gmId
                    ? TeamRole.Gm
                    : TeamRole.Player,
                joinedAt: new Date().toISOString(),
                leftAt: null as string | null,
              }));

              return this.removeDeletedMembers(
                updatedTeam.id,
                uniqueMembers
              ).pipe(
                switchMap(() =>
                  this.backend.upsertMany<IPartyMember>(
                    'party_members',
                    toSnakeCase(memberRequests),
                    'team_id,user_id'
                  )
                )
              );
            }),
            map(() => updatedTeam)
          );
      })
    );
  }

  updateBeginnersProgramAndStage(
    teamId: string,
    beginnersProgram: boolean,
    programStage: 1 | 2 | null
  ) {
    const payload: Partial<IParty> = { beginnersProgram, programStage };
    return this.backend.update<IParty>('parties', teamId, toSnakeCase(payload));
  }

  updateProgramStage(teamId: string, programStage: 1 | 2 | null) {
    return this.backend.update<IParty>(
      'parties',
      teamId,
      toSnakeCase({ programStage })
    );
  }

  deleteParty(id: string): Observable<void> {
    return this.backend.delete('parties', id);
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
    return this.backend.update<IPartyMember>('party_members', requestId, {
      leftAt: null,
    });
  }

  rejectRequest(requestId: string): Observable<void> {
    return this.backend.delete('party_members', requestId);
  }

  computeTeamTypes(
    byTeam: Map<string, IPartyMember[]>,
    usersById: Map<string, IUser>
  ): Map<string, PartyType> {
    const out = new Map<string, PartyType>();

    for (const [teamId, members] of byTeam.entries()) {
      const roles = members
        .map((m) => usersById.get(m.userId)?.coworker ?? null)
        .filter((r): r is CoworkerRoles => r !== null);

      const allClub =
        roles.length > 0 && roles.every((r) => r === CoworkerRoles.Member);
      const anyGolden = roles.some((r) => r === CoworkerRoles.Golden);

      const type = allClub
        ? PartyType.Club
        : anyGolden
        ? PartyType.Golden
        : PartyType.Regular;
      out.set(teamId, type);
    }
    return out;
  }

  // ===== Helpers =====
  private removeDeletedSystems(
    teamId: string,
    systems: string[]
  ): Observable<void> {
    return this.backend
      .getAll<IPartySystem>('party_systems', 'teamId', 'asc', {
        filters: { teamId: { operator: FilterOperator.EQ, value: teamId } },
      })
      .pipe(
        switchMap((existing) => {
          const existingIds = existing.map((s) => s.systemId);
          const keep = new Set(systems ?? []);
          const toDelete = existingIds.filter((id) => !keep.has(id));
          if (!toDelete.length) return of(void 0);

          return forkJoin(
            toDelete.map((systemId) =>
              this.backend.delete('party_systems', {
                teamId: { value: teamId, operator: FilterOperator.EQ },
                systemId: { value: systemId, operator: FilterOperator.EQ },
              })
            )
          ).pipe(map(() => void 0));
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
        switchMap((existing) => {
          const existingIds = existing.map((m) => m.userId);
          const keep = new Set(members ?? []);
          const toDelete = existingIds.filter((id) => !keep.has(id));
          if (!toDelete.length) return of(void 0);

          return forkJoin(
            toDelete.map((userId) =>
              this.backend.delete('party_members', {
                teamId: { value: teamId, operator: FilterOperator.EQ },
                userId: { value: userId, operator: FilterOperator.EQ },
              })
            )
          ).pipe(map(() => void 0));
        })
      );
  }
}
