import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackendService } from '../../core/services/backend/backend.service';
import { LoaderService } from '../../core/services/loader/loader.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { TechStack } from '../../core/interfaces/i-techStack';
import { Roles } from '../../core/enums/roles';
import { LoaderComponent } from '../../common/loader/loader.component';

@Component({
  selector: 'app-tech-stack',
  standalone: true,
  imports: [CommonModule, LoaderComponent],
  templateUrl: './tech-stack.component.html',
  styleUrl: './tech-stack.component.scss'
})
export class TechStackComponent implements OnInit {
  private readonly backendService = inject(BackendService);
  private readonly loaderService = inject(LoaderService);
  private readonly platformService = inject(PlatformService);
  private readonly seo = inject(SeoService);

  techStack = signal<TechStack[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  showAll = signal(false);

  readonly visibleTechStack = computed(() =>
    this.showAll() ? this.techStack() : this.techStack().slice(0, 4)
  );

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Nasz zespół');
    if (this.platformService.isBrowser) {
      this.loadTechStack();
    }
  }

  private loadTechStack(): void {
    this.loaderService.show();
    this.backendService.getAll<TechStack>('tech_stack', 'id', 'asc', undefined, { width: 234, height: 234 })
      .subscribe({
        next: (data) => {
          const filtered = data.filter((item) => item.isActive && item.role === Roles.Gm);
          if (filtered.length === 0) {
            this.error.set('Nie znaleziono żadnych aktywnych członków zespołu.');
          } else {
            this.techStack.set(filtered);
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Błąd podczas pobierania danych:', err);
          this.error.set('Nie udało się załadować danych.');
          this.isLoading.set(false);
        },
        complete: () => this.loaderService.hide()
      });
  }
}
