import { CommonModule } from '@angular/common';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { map, startWith, takeUntil } from 'rxjs/operators';
import { register } from 'swiper/element/bundle';
import { PlatformService } from '../../core/services/platform/platform.service';

const SMALL_BP = 1024;

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HowItWorksComponent implements OnInit, OnDestroy {
  private readonly platform = inject(PlatformService);
  private readonly destroy$ = new Subject<void>();

  readonly isSmallScreen = signal(false);

  readonly steps = [
    {
      id: 1,
      title: 'Wybierz salę RPG',
      description:
        'Zaloguj się i wybierz jedną z naszych klimatycznych sal do gier fabularnych – od standardowych po VIP. Idealne warunki do sesji w Poznaniu.',
      icon: '/icons/doorway.svg',
      optional: false,
    },
    {
      id: 2,
      title: 'Zarezerwuj termin sesji',
      description:
        'Zarezerwuj online lub skontaktuj się z nami mailowo/telefonicznie. Wynajem sali rozliczamy godzinowo – płacisz tylko za realny czas gry.',
      icon: '/icons/calendar.svg',
      optional: false,
    },
    {
      id: 3,
      title: 'Dobierz Mistrza Gry (opcjonalnie)',
      description:
        'Nie masz prowadzącego? Wybierz Mistrza Gry z naszego zespołu – świetna opcja dla początkujących i powracających do RPG.',
      icon: '/icons/book-aura.svg',
      optional: true,
    },
    {
      id: 4,
      title: 'Przyjdź z drużyną i graj',
      description:
        'Zbierz bohaterów, rozłóż podręczniki i kostki, i zanurz się w przygodzie. Ragnarok to miejsce stworzone z myślą o graczach RPG w Poznaniu i całej Polsce.',
      icon: '/icons/team-idea.svg',
      optional: false,
    },
  ] as const;

  readonly swiperLoop = computed(() => this.steps.length > 1);

  ngOnInit(): void {
    if (this.platform.isBrowser) {
      register();
      const win = this.platform.getWindow()!;
      fromEvent(win, 'resize')
        .pipe(
          startWith(null),
          map(() => win.innerWidth <= SMALL_BP),
          takeUntil(this.destroy$)
        )
        .subscribe((isSm) => this.isSmallScreen.set(isSm));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (s: (typeof this.steps)[number]) => s.id;
}
