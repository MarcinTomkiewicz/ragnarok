import { Component, inject, OnInit } from '@angular/core';
import { BackendService } from '../../core/services/backend/backend.service';
import { forkJoin, Subscription } from 'rxjs';
import { Category, Offer, Subcategory } from '../../core/interfaces/i-offers';
import { NgbAccordionModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { CategoryType } from '../../core/enums/categories';
import { PlatformService } from '../../core/services/platform/platform.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CategoryService } from '../../core/services/category/category.service';
import { CategoryListComponent } from '../../common/category-list/category-list/category-list.component';

@Component({
  selector: 'app-offers-list',
  standalone: true,
  imports: [CommonModule, NgbAccordionModule, NgbDropdownModule, RouterModule, CategoryListComponent],
  templateUrl: './offers-list.component.html',
  styleUrl: './offers-list.component.scss'
})
export class OffersListComponent implements OnInit {

  private readonly backendService = inject(BackendService)
  private readonly platformService = inject(PlatformService);
  readonly categoryService = inject(CategoryService)
  readonly CategoryType = CategoryType

  private readonly subcategorySubscription!: Subscription;

  offers = [
    {
      imageUrl: 'https://copcorp.pl/wp-content/uploads/2019/06/Warhammer-4-ed-Standard-OKLADKA-e1560066828794.png',
      title: 'Warhammer Fantasy Role Play 4 ed.',
      price: 185.99,
      stock: 2,
      buyNowLink: 'http://localhost:4200',
      description: 'Trudno odłożyć tę książkę, prawda?\nJakby sama trzymała się Waszych dłoni. Wiecie dobrze, co znajduje się w środku. Kryją się tam spaczeni, niepokorni, zagubieni. Mówicie sobie, że chcielibyście odejść i zostawić to za sobą. Czmychnąć do idealnego świata, gdzie wszystko układa się jak po sznurze. To nieprawda. Coś ciągnie Was właśnie tutaj. Możecie tłumaczyć sobie, że kuszą was bogactwa albo żądza chwały. Nie łudźcie się. Wszyscy wiemy, że jest inaczej. Kto raz usłyszał, jak wzywają go szlaki Starego Świata, ten zawsze już będzie chciał na nie powrócić. Dobądźcie ostrzy, nabijcie pistolety i uważajcie na tego psa: może i jest mały, ale jaki zajadły!\nWarhammer Fantasy Roleplay zabiera Was do Starego Świata. Skompletujcie własną drużynę śmiałków lub bandę oprychów i wyruszcie we wspólną podróż. W jej trakcie będziecie mierzyć się z podłością, zepsuciem, intrygami i straszliwymi bestiami pałającymi chęcią destrukcji.\nTen podręcznik zawiera wszystko, czego potrzebujcie, by rozpocząć przygodę w ponurym świecie niebezpiecznych przygód!.',
      categoryId: 1,
      subcategoryId: 1,
    },
    {
      imageUrl: 'https://pegaz-gry.pl/54-large_default/podrecznik-zew-cthulhu-ksiega-straznika-7-edycja-sklep-bydgoszcz.jpg',
      title: 'Zew Cthulhu 7 ed.',
      price: 203.99,
      stock: 1,
      buyNowLink: '',
      description: 'Pozwól się wciągnąć w niepokojący świat mitów H.P. Lovecrafta, zbierz drużynę Badaczy Tajemnic i opowiedz im przerażającą historię.\nZew Cthulhu 7. Edycja to kultowa gra fabularna pełna tajemnic i horrorów, gdzie jeden z graczy wciela się w rolę Strażnika Tajemnic, narratora opowiadającego historię, a reszta uczestników gry to Badacze Tajemnic, rozwiązujący zagadki bohaterowie z przypadku. Gracze, ścigając się z czasem, próbują powstrzymać mroczne siły przed przejęciem kontroli nad naszym światem.\nDLACZEGO ZEW CTHULHU\nKultowy system znany i ceniony od lat.\nKlimat Stranger Things i True Detective.\nPrzerażający i tajemniczy świat.\nŚwietna, detektywistyczna konwencja.\nElastyczny system pasujący do każdej epoki.\nIntuicyjna i bezproblemowa mechanika.',
      categoryId: 1,
      subcategoryId: 2,
    },
    {
      imageUrl: 'https://rpgalchemia.pl/wp-content/uploads/2021/05/cover-2.png',
      title: 'Wampir: Maskarada',
      price: 218.99,
      stock: 0,
      buyNowLink: '',
      description: 'Wampir: Maskarada to oryginalna, wyjątkowa gra fabularna osobistego i politycznego horroru. Wcielasz się w wampira walczącego o przeżycie, zwierzchnictwo i o swoje zanikające człowieczeństwo – pełen obaw o to, do czego jesteś zdolny, oraz przerażony otaczającymi cię nieludzkimi spiskami.\nJako wampir odczuwasz mękę wynikającą z Głodu, bezwzględnego i potwornego pragnienia ludzkiej krwi. Jeśli nie zechcesz mu sprostać, przejmie twój umysł i doprowadzi cię do potwornych czynów. Wszystko po to, by go ugasić.\nKażdej nocy będziesz poruszać się po krawędzi brzytwy.\nMroczne cele, zawzięci wrogowie oraz osobliwi sprzymierzeńcy oczekują na ciebie w Świecie Mroku.\nKlasyka, która na zawsze odmieniła gry fabularne, powraca!\n5 edycja zawiera uproszczone, unowocześnione zasady i nowe, piękne ilustracje w pełnym kolorze oraz oferuje graczom intensywne przeżywanie historii.\nOparta o nowatorski cykl Głodu, zawiera także zasady tworzenia wspieranych przez system koterii, Karty Fabuły bezpośrednio angażujące graczy w ich ulubione elementy Świata Mroku, jak również Memoriam – nowy sposób odwzorowywania szczegółowego tła postaci i rozwijania go w trakcie sesji.\n5 edycja to powrót do pierwotnej wizji Wampira, odważnie przeniesiony w XXI wiek. Choć zasady zostały przeprojektowane, uszanowano rozległą historię znaną z oryginału, rozwijając fabułę od momentu, w którym wcześniej ją przerwano i pokazując szczegółowo, co zaszło w świecie Spokrewnionych, aż do chwili obecnej.\nTerror Drugiej Inkwizycji, siły stojące za Wojną Gehenny oraz rozbudzona na nowo Wojną Epok – to fundamenty współczesnej kroniki piątej edycji.\nZaprojektowana, napisana i rozwinięta przez następujących autorów: Kenneth Hite, Mark Rein-Hagen, Matthew Dawkins, Juhanna Peterson, Martin Ericsson, Karim Muammar, Karl Bergström, Jennifer Smith, Jason Andrew i Jason Carl.\nPolski podręcznik uwzględnia najnowszą erratę oraz 26 stron rozszerzonego materiału zawierającego:\nWięcej Kart Fabuły: Potomek Tyler, Potomek Zeliosa, Potomek Vasantaseny, Wysoki Klan, Niski Klan, Ambrus Maropis, Carmelita Neillson, Fiorenza Savona, Potomek Karla Schrekta, Potomek Xaviara.\nTypowe działania: Przykłady działań, którymi twoja postać może zajmować się w czasie swojego życia po życiu, podzielona na Umysłowe, Fizyczne i Społeczne.\nAneks do Projektów: Rozszerzone reguły umożliwiające twojej postaci realizowanie długoterminowych projektów, by osiągać cele wykraczające poza ich conocną działalność.\nAneks do Rozważnej Gry: Doskonały poradnik o tym, jak wprowadzić do twojej gry zawiłe tematy i jak zapewnić każdemu przy stole dobrze spędzony czas.',
      categoryId: 1,
      subcategoryId: 1,
    }
  ];

  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  offersList: Offer[] = [];
  filteredOffers: Offer[] = [];

  ngOnInit(): void {
    this.categoryService.loadCategories().subscribe({
      next: ({ categories, subcategories }) => {
        this.categories = categories;
        this.subcategories = subcategories;
        this.loadOffers();
      },
      error: (err) => console.error('Błąd podczas pobierania kategorii:', err)
    });
  }
  
  loadOffers(): void {
    this.backendService.getAll<Offer>('offers', 'id', 'asc').subscribe({
      next: (offers) => {
        this.offersList = offers;
        this.filteredOffers = offers;
      },
      error: (err) => console.error('Błąd podczas pobierania ofert:', err),
      complete: () => console.log('Oferty zostały pobrane'),
    });
  }

  filterOffersBySubcategory(subcategoryId: number | null): void {
    if (subcategoryId === null) {
      this.filteredOffers = this.offersList;
    } else {
      this.filteredOffers = this.offersList.filter(
        (offer) => offer.subcategoryId === subcategoryId
      );
    }
  }

  onSubcategoryClick(subcategoryId: number | null): void {
    this.filterOffersBySubcategory(subcategoryId);
  }
  
  getCategoryName(id: number, categoryType: CategoryType): string {
    return this.categoryService.getCategoryName(id, categoryType);
  }

  isMobile(): boolean {
    return this.platformService.isBrowser && window.innerWidth < 550;
  }

  buyNow(link: string) {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }  

}
