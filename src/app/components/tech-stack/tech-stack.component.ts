import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { startWith, map } from 'rxjs/operators';
import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { register } from 'swiper/element/bundle';

import { GmDirectoryService } from '../../auth/core/services/gm/gm-directory/gm-directory.service';
import { GmDetailsModalComponent } from '../../common/gm-details-modal/gm-details-modal.component';
import { LoaderComponent } from '../../common/loader/loader.component';
import { CoworkerRoles, RoleDisplay } from '../../core/enums/roles';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { LoaderService } from '../../core/services/loader/loader.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';

const SMALL_BP = 767;

@Component({
  selector: 'app-tech-stack',
  standalone: true,
  imports: [CommonModule, LoaderComponent],
  templateUrl: './tech-stack.component.html',
  styleUrl: './tech-stack.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class TechStackComponent implements OnInit {
  private readonly loader = inject(LoaderService);
  private readonly platform = inject(PlatformService);
  private readonly seo = inject(SeoService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);

  readonly gms = signal<IGmData[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showAll = signal(false);

  readonly visibleGms = computed(() =>
    this.showAll() ? this.gms() : this.gms().slice(0, 4)
  );
  readonly shouldShowMoreButton = computed(
    () => !this.showAll() && this.gms().length > 4
  );

  readonly isSmallScreen = signal(false);
  readonly swiperLoop = computed(() => this.gms().length > 1);

  readonly roleDisplay = RoleDisplay[CoworkerRoles.Gm];

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Nasi Mistrzowie Gry');

    if (!this.platform.isBrowser) {
      this.isLoading.set(false);
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

    this.loadData();
  }

  private loadData(): void {
    this.loader.show();
    this.gmDirectory.getAllGms().subscribe({
      next: (rows) => {
        const uniq = this.deduplicateByUserId(rows ?? []);
        // defensywnie sortujemy po dacie (rosnąco)
        uniq.sort(
          (a, b) =>
            this.dateMs(a.gmProfileCreatedAt) -
            this.dateMs(b.gmProfileCreatedAt)
        );
        this.gms.set(uniq);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Nie udało się pobrać danych.');
        this.isLoading.set(false);
      },
      complete: () => this.loader.hide(),
    });
  }

  private dateMs(d: Date | string | null | undefined): number {
    if (!d) return 0;
    return d instanceof Date ? d.getTime() : new Date(d).getTime();
  }

  private deduplicateByUserId(data: IGmData[]): IGmData[] {
    const seen = new Set<string>();
    const out: IGmData[] = [];
    for (const it of data) {
      if (!seen.has(it.userId)) {
        seen.add(it.userId);
        out.push(it);
      }
    }
    return out;
  }

  onCardClick(gm: IGmData): void {
    const ref = this.modal.open(GmDetailsModalComponent, {
      size: 'lg',
      centered: true,
    });
    ref.componentInstance.gm = gm;
  }

  gmDisplayName(gm: IGmData): string {
    return this.gmDirectory.gmDisplayName(gm);
  }
}
