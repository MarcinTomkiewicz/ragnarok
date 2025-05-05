import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule, NgbCarouselConfig } from '@ng-bootstrap/ng-bootstrap';
import { CarouselComponent } from '../../common/carousel/carousel.component';
import { TechStack } from '../../core/interfaces/i-techStack';
import { BackendService } from '../../core/services/backend/backend.service';
import { LoaderService } from '../../core/services/loader/loader.service';
import { PlatformService } from '../../core/services/platform/platform.service';  // Dodano
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-tech-stack',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule, CarouselComponent],
  providers: [NgbCarouselConfig],
  templateUrl: './tech-stack.component.html',
  styleUrl: './tech-stack.component.scss'
})
export class TechStackComponent implements OnInit {
  private readonly backendService = inject(BackendService);
  private readonly loaderService = inject(LoaderService);
  private readonly platformService = inject(PlatformService);  // Dodano
  private readonly seo = inject(SeoService);

  techStack = signal<TechStack[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  techStackLoaded = computed(() => this.techStack().length > 0);

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Nasz zespół')
    // Tylko po stronie przeglądarki wykonuj operację z loaderem
    if (this.platformService.isBrowser) {
      this.loadTechStack();
    }
  }

  /**
   * Pobiera dane z tabeli 'tech_stack' w Supabase
   */
  private loadTechStack(): void {
    this.loaderService.show();
    this.backendService.getAll<TechStack>('tech_stack', 'id', 'asc', undefined, {width: 234, height: 234}).subscribe({
      next: (data) => {
        const dataToShow = data.filter((item) => item.isActive);
        if (dataToShow.length === 0) {
          this.error.set('Nie znaleziono żadnych aktywnych członków zespołu.');
          this.isLoading.set(false);
        } else {
        this.techStack.set(dataToShow);
        this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('Błąd podczas pobierania danych:', err);
        this.error.set('Nie udało się załadować danych.');
        this.isLoading.set(false);
      },
      complete: () => this.loaderService.hide(),
    });
  }
}
