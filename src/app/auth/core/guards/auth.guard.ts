import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  UrlTree,
} from '@angular/router';
import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  hasMinimumCoworkerRole,
  hasMinimumSystemRole,
} from '../../../core/utils/required-roles';
import { LoaderService } from '../../../core/services/loader/loader.service';
import { finalize, map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  loader = inject(LoaderService);
  router = inject(Router);
  authService = inject(AuthService);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const requiredRoles = route.data['roles'] as SystemRole[] | undefined;
    const requiredCoworkerRoles = route.data['coworkerRoles'] as
      | CoworkerRoles[]
      | undefined;
    const minCoworkerRole = route.data['minCoworkerRole'] as
      | CoworkerRoles
      | undefined;
    const minSystemRole = route.data['minSystemRole'] as SystemRole | undefined;
    const authOnly = route.data['authOnly'] as boolean | undefined;

    const requiresAuth = !!(
      requiredRoles ||
      requiredCoworkerRoles ||
      minCoworkerRole ||
      minSystemRole ||
      authOnly
    );

    this.loader.show();

    return this.authService.loadUser().pipe(
      map(() => {
        const user = this.authService.user();

        if (!user && requiresAuth) {
          return this.router.parseUrl('/not-authorized');
        }

        if (user) {
          const hasSystemRole =
            !requiredRoles || requiredRoles.includes(user.role);
          const hasMinSystemRole =
            !minSystemRole || hasMinimumSystemRole(user, minSystemRole);
          const hasExactCoworker =
            !requiredCoworkerRoles ||
            user.role === SystemRole.Admin ||
            (user.coworker && requiredCoworkerRoles.includes(user.coworker));
          const hasMinCoworker =
            !minCoworkerRole || hasMinimumCoworkerRole(user, minCoworkerRole);

          if (
            hasSystemRole &&
            hasMinSystemRole &&
            hasExactCoworker &&
            hasMinCoworker
          ) {
            return true;
          }
        }

        return this.router.parseUrl('/not-authorized');
      }),
      finalize(() => this.loader.hide())
    );
  }
}
