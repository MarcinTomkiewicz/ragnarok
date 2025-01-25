import { Component, ViewEncapsulation, inject } from '@angular/core';
import { IServices } from '../../core/interfaces/i-services';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ServicesTableComponent } from '../../common/services-table/services-table.component';
import { RegulationsComponent } from '../regulations/regulations.component'

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, ServicesTableComponent],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ServicesComponent {
  private readonly modalService = inject(NgbModal);

  standardRooms: IServices[] = [
    {
      name: '1-2 godziny',
      price: 80,
      priceType: 'hour',
      shortDescription: 'Salka na 1-2 godziny, wyposażona w laptopa, nagłośnienie, stół z krzesłami.',
    },
    {
      name: '3-4 godziny',
      price: 75,
      priceType: 'hour',
      shortDescription: 'Salka na 3-4 godziny, wyposażona w laptopa, nagłośnienie, stół z krzesłami.',
    },
    {
      name: '5-6 godzin',
      price: 70,
      priceType: 'hour',
      shortDescription: 'Salka na 5-6 godzin, wyposażona w laptopa, nagłośnienie, stół z krzesłami.',
    },
    {
      name: '7+ godzin',
      price: 65,
      priceType: 'hour',
      shortDescription: 'Salka na 7+ godzin, wyposażona w laptopa, nagłośnienie, stół z krzesłami.',
    },
  ];
  
  vipRooms: IServices[] = [
    {
      name: '1-2 godziny',
      price: 95,
      priceType: 'hour',
      shortDescription: 'Salka na 1-2 godziny, wyposażona w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
    {
      name: '3-4 godziny',
      price: 90,
      priceType: 'hour',
      shortDescription: 'Salka na 3-4 godziny, wyposażona w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
    {
      name: '5-6 godzin',
      price: 85,
      priceType: 'hour',
      shortDescription: 'Salka na 5-6 godzin, wyposażona w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
    {
      name: '7+ godzin',
      price: 80,
      priceType: 'hour',
      shortDescription: 'Salka na 7+ godzin, wyposażona w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
  ];

  passes: IServices[] = [
    {
      name: 'Karnet Legendy Ragnarok',
      price: 1300,
      priceType: 'piece',
      shortDescription: '20 godzin do wykorzystania + 4 dodatkowe godziny gratis.',
      longDescription: 'Karnet Legendy Ragnarok oferuje 20 godzin w standardowej salce, wyposażonej w laptopa, nagłośnienie, stół i krzesła. Dodatkowo w ramach oferty otrzymujesz 4 godziny gratis, aby w pełni wykorzystać potencjał naszych przestrzeni.',
    },
    {
      name: 'Karnet Legendy Ragnarok VIP',
      price: 1600,
      priceType: 'piece',
      shortDescription: '20 godzin w salce VIP + 4 dodatkowe godziny w salce VIP gratis.',
      longDescription: 'Karnet Legendy Ragnarok VIP oferuje 20 godzin w ekskluzywnej salce VIP, wyposażonej w wygodne fotele, funkcjonalne stoliki podręczne, laptopa i nagłośnienie. Dodatkowe 4 godziny gratis pozwalają cieszyć się jeszcze dłuższym czasem w luksusowych warunkach.',
    },
    {
      name: 'Karnet Bogowie Ragnarok',
      price: 2500,
      priceType: 'piece',
      shortDescription: '40 godzin do wykorzystania + 10 dodatkowych godzin gratis.',
      longDescription: 'Karnet Bogowie Ragnarok zapewnia 40 godzin w standardowej salce, wyposażonej w laptopa, nagłośnienie, stół i krzesła. Dodatkowe 10 godzin gratis pozwala na jeszcze większą elastyczność i komfort użytkowania przestrzeni.',
    },
    {
      name: 'Karnet Bogowie Ragnarok VIP',
      price: 3000,
      priceType: 'piece',
      shortDescription: '40 godzin w salce VIP + 10 dodatkowych godzin w salce VIP gratis.',
      longDescription: 'Karnet Bogowie Ragnarok VIP zapewnia 40 godzin w przestronnej i komfortowej salce VIP, wyposażonej w wygodne fotele, funkcjonalne stoliki podręczne, laptopa i nagłośnienie. Dodatkowe 10 godzin gratis gwarantuje pełną swobodę i niezapomniane doświadczenia.',
    },
  ];

  additionalServices: IServices[] = [
    {
      name: 'Mistrz Gry na życzenie',
      price: 50,
      priceType: 'hour',
      shortDescription: 'Godzina sesji z Mistrzem Gry - sprawdź dostępność naszych Mistrzów Gry oraz systemy, które prowadzą. Cena nie uwzględnia kosztu rezerwacji salki.',
      longDescription: 'Koszt obejmuje jedną godzinę sesji z naszym Mistrzem Gry w wybrany przez Ciebie system. W cenie jest przygotowanie sesji, fabuły, dodatków itp. Na życzenie Mistrz Gry stworzy postacie samodzielnie, albo w ramach wykupionego czasu, stworzycie je wspólnie.'
    },
  ]

  openRules(type: 'pass' | 'rent') {
    const modalRef = this.modalService.open(RegulationsComponent, { size: 'lg' });
    modalRef.componentInstance.type = type;
  }
}
