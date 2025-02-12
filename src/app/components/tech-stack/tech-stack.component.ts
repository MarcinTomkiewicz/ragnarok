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

// techStack: TechStack[] = [
//   {
//     name: 'Vlad',
//     image: 'staff/vlad2.png',
//     description: 'Jarl Ragnaroku. Mistrz Gry i fan gier RPG od prawie 30 lat.',
//     longDescription: 'Specjalista od Warhammera, Zewu Cthulhu, Świata Mroku i twórczości klasyków literatury fantasy.'
//   },
//   {
//     name: 'Kama',
//     image: 'staff/kama.jpg',
//     description: 'Jarlkona Ragnaroku. Wielka fanka komiksów i filmów o superbohaterach.',
//     longDescription: 'Jeśli tylko pozwolicie to zasypie was ciekawostkami o Marvelu i DC. Najlepiej zorientowana w temacie kto z kim co i dlaczego.'
//   },
//   {
//     name: 'Dawid',
//     image: 'staff/dawid.jpeg',
//     description: 'Huskarl Ragnaroku. Zajmuje się obsługą recepcji i zarządzaniem rezerwacjami.',
//     longDescription: 'W wolnych chwilach zajmuje się też mistrzowaniem oraz jeździ na konwenty.'
//   },
//   {
//     name: 'Melwin',
//     image: 'staff/no-photo.png',
//     description: 'Huskarl Ragnaroku. Gracz i Mistrz Gry od kilku lat.',
//     longDescription: 'W Ragnaroku zajmuje się obsługą recepcji i zarządzaniem rezerwacjami.'
//   },
//   {
//     name: 'Mateusz',
//     image: 'staff/mati.jpg',
//     description: 'Dyżurny Mistrz Gry. Prowadzi Zew Cthulhu, Warhammer Fantasy Role Play, Wiedźmin RPG oraz Dungeon and Dragons 2024.',
//     longDescription: ''
//   },
//   {
//     name: 'Kajetan',
//     image: 'staff/kajetan.png',
//     description: 'Dyżurny Mistrz Gry. Od długiego czasu prowadzi różne systemy - przede wszystkim Mork Borg, CY_Borg oraz Zew Cthulhu.',
//     longDescription: 'Warto sprawdzać dostępność, bo bywa dostępny o różnych porach.'
//   },
//   {
//     name: 'Kuba',
//     image: 'staff/kuba.jpg',
//     description: 'Dyżurny Mistrz Gry. Spec od Pathfindera, rozpoczynał od D&D a także studiował Zew Cthulhu na Uniwersytecie Miskatonic.',
//     longDescription: 'Warto sprawdzać dostępność, bo bywa dostępny o różnych porach.'
//   },
  
// ];
