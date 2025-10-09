import { Routes } from '@angular/router';
import { LoginComponent } from '../../components/login/login.component';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';

export const BASE_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('../../components/registration/registration.component')
        .then(m => m.RegistrationComponent),
  },
  {
    path: 'edit-data',
    loadComponent: () =>
      import('../../components/edit-data/edit-data.component')
        .then(m => m.EditDataComponent),
    canActivate: [AuthGuard],
    data: { authOnly: true },
  },

  {
    path: 'coworker-files',
    loadComponent: () =>
      import('../../components/coworker-personal-files/coworker-personal-files.component')
        .then(m => m.CoworkerPersonalFilesComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
  },

  {
    path: 'users-admin',
    loadComponent: () =>
      import('../../components/users-admin/users-admin.component')
        .then(m => m.UsersAdminComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
  {
    path: 'offers',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../../components/offers-admin/offers-admin.component').then(
            (m) => m.OffersAdminComponent
          ),
      },
      // {
      //   path: ':slug', // ← edycja po slugu
      //   loadComponent: () =>
      //     import('../../components/offer-edit/offer-edit.component').then(
      //       (m) => m.OfferEditComponent
      //     ),
      // },
    ]
  }
];
