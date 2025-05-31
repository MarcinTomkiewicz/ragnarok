import { Component } from '@angular/core';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss'
})
export class HowItWorksComponent {
  steps = [
  {
    id: 1,
    title: 'Wybierz pokój',
    description: 'Wybierz jedną z naszych klimatycznych sal – od standardowych po VIP.',
    icon: '/icons/doorway.svg',
  },
  {
    id: 2,
    title: 'Zarezerwuj termin',
    description: 'Zarezerwuj mailowo lub telefonicznie – szybko i wygodnie.',
    icon: '/icons/calendar.svg',
  },
  {
    id: 3,
    title: 'Znajdź Mistrza Gry',
    description: 'Nie masz MG? Wybierz jednego z naszych doświadczonych prowadzących.',
    icon: '/icons/book-aura.svg',
    optional: true,
  },
  {
    id: 4,
    title: 'Przyjdź z drużyną',
    description: 'Zbierz swoich bohaterów i przygotuj się na przygodę!',
    icon: '/icons/team-idea.svg',
  },
];


}
