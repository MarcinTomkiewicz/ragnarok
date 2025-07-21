import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IClubMembership } from '../../core/interfaces/i-club-membership';
import { BackendService } from '../../core/services/backend/backend.service';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-club-membership',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './club-membership.component.html',
  styleUrl: './club-membership.component.scss',
})
export class ClubMembershipComponent {
  private readonly backend = inject(BackendService);
  private readonly seo = inject(SeoService);

  memberships = toSignal(
    this.backend.getAll<IClubMembership>(
      'club_memberships',
      'position',
      'asc',
      undefined,
      undefined,
      'membership_perks(*)'
    ),
    { initialValue: [] }
  );

  ngOnInit() {
    this.seo.setTitleAndMeta(
      'Członkostwo w Klubie Gier Fabularnych Ragnaroku',
      'Dołącz do naszego Klubu Gier Fabularnych i korzystaj z wyjątkowych przywilejów!'
    );
  }

  log(data: any) {
    console.log(data);
  } 
}
