import { Routes } from '@angular/router';
import { PartyResolver } from '../resolvers/party-resolver';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';

export const PARTIES_ROUTES: Routes = [
  {
    path: 'create-party',
    loadComponent: () =>
      import('../../components/create-party/create-party.component').then(
        (m) => m.CreatePartyComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'edit-party/:slug',
    loadComponent: () =>
      import('../../components/create-party/create-party.component').then(
        (m) => m.CreatePartyComponent
      ),
    resolve: { party: PartyResolver },
    canActivate: [AuthGuard],
  },
  {
    path: 'my-parties',
    loadComponent: () =>
      import('../../components/my-parties/my-parties.component').then(
        (m) => m.MyTeamsComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'party-list',
    loadComponent: () =>
      import('../../common/parties-table/parties-table.component').then(
        (m) => m.PartiesTableComponent
      ),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
  {
    path: 'find-party',
    loadComponent: () =>
      import('../../common/parties-table/parties-table.component').then(
        (m) => m.PartiesTableComponent
      ),
    canActivate: [AuthGuard],
    data: { publicMode: true },
  },
];
