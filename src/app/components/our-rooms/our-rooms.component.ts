import { Component, inject } from '@angular/core';
import { CarouselComponent } from '../../common/carousel/carousel.component';
import { CommonModule } from '@angular/common';
import { TechStack } from '../../core/interfaces/i-techStack';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-our-rooms',
  standalone: true,
  imports: [CarouselComponent, CommonModule],
  templateUrl: './our-rooms.component.html',
  styleUrl: './our-rooms.component.scss'
})
export class OurRoomsComponent {
private readonly seo = inject(SeoService);

ngOnInit() {
  this.seo.setTitleAndMeta('Nasze pomieszczenia')
}


  ourRoomsDetails: TechStack[] = [
      {
        id: 1,
        name: 'Salka Midgard',
        imageURL: 'rooms/midgard.avif',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        id: 2,
        name: 'Salka Asgard',
        imageURL: 'rooms/asgard.avif',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        id: 3,
        name: 'Salka Alfheim',
        imageURL: 'rooms/alfheim.avif',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        id: 4,
        name: 'Salka Jotunheim',
        imageURL: 'rooms/jotunheim.avif',
        description: 'Salka VIP, wyposażona w 6 wygodnych foteli, funkcjonalne podręczne stoliki oraz Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na długie posiedzenia z RPG.'
      },
    ]

}
