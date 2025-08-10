import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { SystemRole } from '../../../core/enums/systemRole';
import {
  hasMinimumCoworkerRole,
  hasStrictCoworkerRole,
} from '../../../core/utils/required-roles';

@Component({
  selector: 'app-user-menu-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-menu-panel.component.html',
  styleUrls: ['./user-menu-panel.component.scss'],
})
export class UserMenuPanelComponent implements OnInit {
  readonly auth = inject(AuthService);
  username: string | null = null;

  isMember = false;
  isGm = false;
  isAdminSection = false;

  ngOnInit(): void {
    const user = this.auth.user();
    this.username = this.auth.userDisplayName(user);

    this.isGm = hasStrictCoworkerRole(user, CoworkerRoles.Gm);
    this.isMember = hasStrictCoworkerRole(user, CoworkerRoles.Member)
    this.isAdminSection =
      hasMinimumCoworkerRole(user, CoworkerRoles.Reception);
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
