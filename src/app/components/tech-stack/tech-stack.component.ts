import { Component } from '@angular/core';
import { TechStack } from '../../core/interfaces/i-techStack';
import { CommonModule } from '@angular/common';
import { NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { CarouselComponent } from '../../common/carousel/carousel.component'

@Component({
  selector: 'app-tech-stack',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule, CarouselComponent],
  providers: [NgbCarouselConfig],
  templateUrl: './tech-stack.component.html',
  styleUrl: './tech-stack.component.scss'
})
export class TechStackComponent {
  techStack: TechStack[] = [
    {
      name: 'Vlad',
      photo: 'staff/vlad2.png',
      description: 'Jarl Ragnaroku. Mistrz Gry i fan gier RPG od prawie 30 lat.',
      longDescription: 'Specjalista od Warhammera, Zewu Cthulhu, Świata Mroku i twórczości klasyków literatury fantasy.'
    },
    {
      name: 'Kama',
      photo: 'staff/kama.jpg',
      description: 'Jarlkona Ragnaroku. Wielka fanka komiksów i filmów o superbohaterach.',
      longDescription: 'Jeśli tylko pozwolicie to zasypie was ciekawostkami o Marvelu i DC. Najlepiej zorientowana w temacie kto z kim co i dlaczego.'
    },
    {
      name: 'Dawid',
      photo: 'staff/dawid.jpeg',
      description: 'Huskarl Ragnaroku. Zajmuje się obsługą recepcji i zarządzaniem rezerwacjami.',
      longDescription: 'W wolnych chwilach zajmuje się też mistrzowaniem oraz jeździ na konwenty.'
    },
    {
      name: 'Melwin',
      photo: 'staff/no-photo.png',
      description: 'Huskarl Ragnaroku. Gracz i Mistrz Gry od kilku lat.',
      longDescription: 'W Ragnaroku zajmuje się obsługą recepcji i zarządzaniem rezerwacjami.'
    },
    {
      name: 'Mateusz',
      photo: 'staff/mati.jpg',
      description: 'Dyżurny Mistrz Gry. Prowadzi Zew Cthulhu, Warhammer Fantasy Role Play, Wiedźmin RPG oraz Dungeon and Dragons 2024.',
      longDescription: ''
    },
    {
      name: 'Kajetan',
      photo: 'staff/kajetan.png',
      description: 'Dyżurny Mistrz Gry. Od długiego czasu prowadzi różne systemy - przede wszystkim Mork Borg, CY_Borg oraz Zew Cthulhu.',
      longDescription: 'Warto sprawdzać dostępność, bo bywa dostępny o różnych porach.'
    },
    
  ];

}
