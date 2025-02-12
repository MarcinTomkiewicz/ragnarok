import { Component } from '@angular/core';
import { CarouselComponent } from '../../common/carousel/carousel.component';
import { CommonModule } from '@angular/common';
import { TechStack } from '../../core/interfaces/i-techStack';

@Component({
  selector: 'app-our-rooms',
  standalone: true,
  imports: [CarouselComponent, CommonModule],
  templateUrl: './our-rooms.component.html',
  styleUrl: './our-rooms.component.scss'
})
export class OurRoomsComponent {
  ourRoomsDetails: TechStack[] = [
      {
        id: 1,
        name: 'Salka Midgard',
        imageURL: 'rooms/midgard.jpg',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        id: 2,
        name: 'Salka Asgard',
        imageURL: 'rooms/asgard.jpg',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        id: 3,
        name: 'Salka Alfheim',
        imageURL: 'rooms/alfheim.jpg',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        id: 4,
        name: 'Salka Jotunheim',
        imageURL: 'rooms/jotunheim.jpg',
        description: 'Salka VIP, wyposażona w 6 wygodnych foteli, funkcjonalne podręczne stoliki oraz Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na długie posiedzenia z RPG.'
      },
    ]

}
