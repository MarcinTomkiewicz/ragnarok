import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule, NgbCarouselConfig } from '@ng-bootstrap/ng-bootstrap';
import { CarouselComponent } from '../../common/carousel/carousel.component';
import { TechStack } from '../../core/interfaces/i-techStack';
import { BackendService } from '../../core/services/backend/backend.service';
import { LoaderService } from '../../core/services/loader/loader.service';

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

  techStack = signal<TechStack[]>([]);
  isLoading = signal(true);
  loaderService = inject(LoaderService)
  error = signal<string | null>(null);

  techStackLoaded = computed(() => this.techStack().length > 0);

  ngOnInit(): void {
    this.loadTechStack();
  }

  /**
   * Pobiera dane z tabeli 'tech_stack' w Supabase
   */
  private loadTechStack(): void {
    this.loaderService.show();
    this.backendService.getAll<TechStack>('tech_stack', 'id', 'asc').subscribe({
      next: (data) => {
        this.techStack.set(data);
        this.isLoading.set(false);
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