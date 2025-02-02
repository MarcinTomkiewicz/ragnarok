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
        name: 'Salka Midgard',
        photo: 'rooms/midgard.jpg',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        name: 'Salka Asgard',
        photo: 'rooms/midgard.jpg',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        name: 'Salka Alfheim',
        photo: 'rooms/midgard.jpg',
        description: 'Salka zwykła, wyposażona w stół, 6 krzeseł, Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na sesje RPG.'
      },
      {
        name: 'Salka Jotunheim',
        photo: 'rooms/jotunheim.jpg',
        description: 'Salka VIP, wyposażona w 6 wygodnych foteli, funkcjonalne podręczne stoliki oraz Chromebooka podłączonego do soundbara.',
        longDescription: 'Wszystko uzupełnia niezwykle klimatyczne oświetlenie, tworzące miejsce idealne na długie posiedzenia z RPG.'
      },
    ]

}
