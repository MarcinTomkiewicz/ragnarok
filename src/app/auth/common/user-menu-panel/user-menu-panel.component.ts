import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth/auth.service';

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

ngOnInit(): void {
    this.username = this.auth.user()?.firstName || null;
}

  logout(): void {
    this.auth.logout().subscribe();
  }
}
