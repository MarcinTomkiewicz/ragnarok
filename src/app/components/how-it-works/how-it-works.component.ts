import { Component } from '@angular/core';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {
  steps = [
    {
      id: 1,
      title: 'Wybierz salę RPG',
      description:
        'Zaloguj się i wybierz jedną z naszych klimatycznych sal do gier fabularnych – od standardowych po VIP. Idealne warunki do sesji w Poznaniu.',
      icon: '/icons/doorway.svg',
    },
    {
      id: 2,
      title: 'Zarezerwuj termin sesji',
      description:
        'Zarezerwuj online lub skontaktuj się z nami mailowo/telefonicznie. Wynajem sali rozliczamy godzinowo – płacisz tylko za realny czas gry.',
      icon: '/icons/calendar.svg',
    },
    {
      id: 3,
      title: 'Dobierz Mistrza Gry (opcjonalnie)',
      description:
        'Nie masz prowadzącego? Wybierz Mistrza Gry z naszego zespołu – świetna opcja dla początkujących i powracających do RPG.',
      icon: '/icons/book-aura.svg',
      optional: true,
    },
    {
      id: 4,
      title: 'Przyjdź z drużyną i graj',
      description:
        'Zbierz bohaterów, rozłóż podręczniki i kostki, i zanurz się w przygodzie. Ragnarok to miejsce stworzone z myślą o graczach RPG w Poznaniu i całej Polsce.',
      icon: '/icons/team-idea.svg',
    },
  ];
}
