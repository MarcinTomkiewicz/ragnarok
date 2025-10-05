import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { fromEvent } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { register } from 'swiper/element/bundle';

import { TechStack } from '../../core/interfaces/i-techStack';
import { PartyService } from '../../core/services/team/team.service';
import { PlatformService } from '../../core/services/platform/platform.service';

const SMALL_BP = 1024;

@Component({
  selector: 'app-meet-the-team',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meet-the-team.component.html',
  styleUrls: ['./meet-the-team.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MeetTheTeamComponent implements OnInit {
  private readonly partyService = inject(PartyService);
  private readonly platform = inject(PlatformService);
  private readonly destroyRef = inject(DestroyRef);

  team: TechStack[] = [];
  readonly isSmallScreen = signal(false);

  ngOnInit() {
    if (!this.platform.isBrowser) {
      this.loadTeam();
      return;
    }

    register();

    const win = this.platform.getWindow()!;
    fromEvent(win, 'resize')
      .pipe(
        startWith(null),
        map(() => win.innerWidth <= SMALL_BP),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((isSm) => this.isSmallScreen.set(isSm));

    this.loadTeam();
  }

  private loadTeam() {
    this.partyService.getCoreTeam().subscribe({
      next: (members) => {
        this.team = members.slice(0, 4);
      },
      error: (err) => console.error('Błąd ładowania zespołu:', err),
    });
  }
}
