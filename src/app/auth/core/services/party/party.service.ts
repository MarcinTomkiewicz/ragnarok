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
import {
  PartyMemberStatus,
  PartyType,
  TeamRole,
} from '../../../../core/enums/party.enum';
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
    if (!ids?.length) return of([] as IUser[]);
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

  getMembers(
    teamId: string,
    statuses?: PartyMemberStatus | PartyMemberStatus[]
  ): Observable<IPartyMember[]> {
    const filters: { [k: string]: IFilter } | undefined =
      statuses == null
        ? undefined
        : Array.isArray(statuses)
        ? { memberStatus: { operator: FilterOperator.IN, value: statuses } }
        : { memberStatus: { operator: FilterOperator.EQ, value: statuses } };
    return this.getPartyMembers(teamId, filters);
  }

  getActiveMembers(teamId: string) {
    return this.getMembers(teamId, PartyMemberStatus.Active);
  }

  getActiveAndPendingMembers(teamId: string) {
    return this.getMembers(teamId, [
      PartyMemberStatus.Active,
      PartyMemberStatus.Pending,
    ]);
  }

  getMembersByStatuses(
    teamId: string,
    statuses: PartyMemberStatus[]
  ): Observable<IPartyMember[]> {
    return this.getPartyMembers(teamId, {
      memberStatus: { operator: FilterOperator.IN, value: statuses },
    });
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

  getPartiesWhereMember(
    userId: string,
    statuses: PartyMemberStatus[] = [PartyMemberStatus.Active]
  ): Observable<IParty[]> {
    return this.backend
      .getAll<IPartyMember>('party_members', 'teamId', 'asc', {
        filters: {
          userId: { operator: FilterOperator.EQ, value: userId },
          memberStatus: { operator: FilterOperator.IN, value: statuses },
        },
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

  // === PENDING DECISIONS ===============================

getPartiesWhereUserCanDecide(userId: string): Observable<IParty[]> {
  return forkJoin([this.getPartiesOwnedBy(userId), this.getPartiesWhereGm(userId)]).pipe(
    map(([owned, gm]) => {
      const byId = new Map<string, IParty>();
      [...owned, ...gm].forEach((p) => byId.set(p.id, p));
      return Array.from(byId.values());
    })
  );
}

getPendingDecisionCountForUser(userId: string): Observable<number> {
  return this.getPartiesWhereUserCanDecide(userId).pipe(
    map((parties) => parties.map((p) => p.id)),
    switchMap((teamIds) => {
      if (!teamIds.length) return of(0);
      return this.backend
        .getAll<IPartyMember>('party_members', 'teamId', 'asc', {
          filters: {
            teamId: { operator: FilterOperator.IN, value: teamIds },
            memberStatus: { operator: FilterOperator.EQ, value: PartyMemberStatus.Pending },
          },
        })
        .pipe(
          map((rows) => rows.filter((m) => !m.leftAt).length)
        );
    })
  );
}

getPendingDecisionCountsByTeamForUser(userId: string): Observable<Record<string, number>> {
  return this.getPartiesWhereUserCanDecide(userId).pipe(
    map((parties) => parties.map((p) => p.id)),
    switchMap((teamIds) => {
      if (!teamIds.length) return of<Record<string, number>>({});
      return this.backend
        .getAll<IPartyMember>('party_members', 'teamId', 'asc', {
          filters: {
            teamId: { operator: FilterOperator.IN, value: teamIds },
            memberStatus: { operator: FilterOperator.EQ, value: PartyMemberStatus.Pending },
          },
        })
        .pipe(
          map((rows) =>
            rows
              .filter((m) => !m.leftAt)
              .reduce((acc, m) => {
                acc[m.teamId] = (acc[m.teamId] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>)
          )
        );
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
    return this.upsertTeam(team).pipe(
      switchMap((t) =>
        this.upsertProfile(t.id, styleTags, description).pipe(map(() => t))
      ),
      switchMap((t) => this.syncSystems(t.id, systems).pipe(map(() => t))),
      switchMap((t) => this.syncMembers(t, members).pipe(map(() => t)))
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
      memberStatus: PartyMemberStatus.Pending,
    };
    return this.backend.create<IPartyMember>(
      'party_members',
      toSnakeCase(data)
    );
  }

  private setMemberStatus(
    memberId: string,
    status: PartyMemberStatus,
    patch: Partial<IPartyMember> = {}
  ): Observable<IPartyMember> {
    const payload: Partial<IPartyMember> = { memberStatus: status, ...patch };
    return this.backend.update<IPartyMember>(
      'party_members',
      memberId,
      toSnakeCase(payload)
    );
  }

  acceptRequest(requestId: string): Observable<IPartyMember> {
    return this.setMemberStatus(requestId, PartyMemberStatus.Active, {
      leftAt: null,
      joinedAt: new Date().toISOString(),
    });
  }

  rejectRequest(requestId: string): Observable<IPartyMember> {
    return this.setMemberStatus(requestId, PartyMemberStatus.Rejected);
  }

  removeMember(memberId: string): Observable<IPartyMember> {
    return this.setMemberStatus(memberId, PartyMemberStatus.Removed, {
      leftAt: new Date().toISOString(),
    });
  }

  leaveParty(memberId: string): Observable<IPartyMember> {
    return this.setMemberStatus(memberId, PartyMemberStatus.Left, {
      leftAt: new Date().toISOString(),
    });
  }

  private getMemberByTeamAndUser(
    teamId: string,
    userId: string
  ): Observable<IPartyMember | null> {
    return this.backend.getOneByFields<IPartyMember>('party_members', {
      team_id: teamId,
      user_id: userId,
    });
  }

  removeMemberByTeamUser(
    teamId: string,
    userId: string
  ): Observable<IPartyMember | null> {
    return this.getMemberByTeamAndUser(teamId, userId).pipe(
      switchMap((m) => (m ? this.removeMember(m.id) : of(null)))
    );
  }

  leavePartyByTeamUser(
    teamId: string,
    userId: string
  ): Observable<IPartyMember | null> {
    return this.getMemberByTeamAndUser(teamId, userId).pipe(
      switchMap((m) => (m ? this.leaveParty(m.id) : of(null)))
    );
  }

  computeTeamTypes(
    byTeam: Map<string, IPartyMember[]>,
    usersById: Map<string, IUser>
  ): Map<string, PartyType> {
    const out = new Map<string, PartyType>();

    for (const [teamId, members] of byTeam.entries()) {
      const active = members.filter(
        (m) => m.memberStatus === PartyMemberStatus.Active && !m.leftAt
      );

      const roles = active
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

  // ===== Private helpers (createOrUpdateParty) =====

  private upsertTeam(team: IParty): Observable<IParty> {
    return this.backend
      .upsert<IParty>('parties', toSnakeCase(team), 'slug')
      .pipe(
        switchMap(() =>
          this.backend.getOneByFields<IParty>('parties', { slug: team.slug })
        ),
        map((updatedTeam) => {
          if (!updatedTeam) {
            throw new Error(
              'Błąd: nie udało się uzyskać zaktualizowanej drużyny'
            );
          }
          return updatedTeam;
        })
      );
  }

  private upsertProfile(
    teamId: string,
    styleTags: GmStyleTag[],
    description: string
  ): Observable<void> {
    const profileData: IPartyProfile = {
      id: teamId,
      description,
      styleTags,
      createdAt: new Date().toISOString(),
    };
    return this.backend
      .upsert<IPartyProfile>('party_profiles', toSnakeCase(profileData), 'id')
      .pipe(map(() => void 0));
  }

  private syncSystems(teamId: string, systems: string[]): Observable<void> {
    const systemIds = systems ?? [];
    const rows = systemIds.map((systemId) => ({ teamId, systemId }));

    return this.removeDeletedSystems(teamId, systemIds).pipe(
      switchMap(() =>
        rows.length
          ? this.backend
              .upsertMany<IPartySystem>(
                'party_systems',
                toSnakeCase(rows),
                'team_id, system_id'
              )
              .pipe(map(() => void 0))
          : of(void 0)
      )
    );
  }

  private syncMembers(team: IParty, members: string[]): Observable<void> {
    const ownerId = team.ownerId ?? null;
    const gmId = team.gmId ?? null;

    const uniqueMembers = Array.from(
      new Set((members ?? []).filter(Boolean))
    ) as string[];

    type InsertPartyMember = Omit<IPartyMember, 'id'>;

    const memberRows: InsertPartyMember[] = uniqueMembers.map((userId) => ({
      teamId: team.id,
      userId,
      role:
        userId === ownerId
          ? TeamRole.Owner
          : userId === gmId
          ? TeamRole.Gm
          : TeamRole.Player,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      memberStatus: PartyMemberStatus.Active,
    }));

    return this.removeDeletedMembers(team.id, uniqueMembers).pipe(
      switchMap(() =>
        memberRows.length
          ? this.backend
              .upsertMany<InsertPartyMember>(
                'party_members',
                toSnakeCase(memberRows),
                'team_id,user_id'
              )
              .pipe(map(() => void 0))
          : of(void 0)
      )
    );
  }

  // ===== Helpers (existing) =====
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
        const keep = new Set(members ?? []);
        const toMark = existing.filter(
          (m) =>
            !keep.has(m.userId) &&
            m.memberStatus === PartyMemberStatus.Active && 
            !m.leftAt
        );

        if (!toMark.length) return of(void 0);

        return forkJoin(
          toMark.map((m) =>
            this.backend.update<IPartyMember>(
              'party_members',
              m.id,
              toSnakeCase<Partial<IPartyMember>>({
                memberStatus: PartyMemberStatus.Removed,
                leftAt: new Date().toISOString(),
              })
            )
          )
        ).pipe(map(() => void 0));
      })
    );
}
}
