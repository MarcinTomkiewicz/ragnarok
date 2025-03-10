import { Component, ViewEncapsulation, inject } from '@angular/core';
import { IServices } from '../../core/interfaces/i-services';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ServicesTableComponent } from '../../common/services-table/services-table.component';
import { RegulationsComponent } from '../regulations/regulations.component';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, ServicesTableComponent],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent {
  private readonly modalService = inject(NgbModal);
  private readonly seo = inject(SeoService);

  ngOnInit() {
    this.seo.setTitleAndMeta('Cennik');
  }

  standardRooms: IServices[] = [
    {
      name: '1-2 godziny',
      price: 16,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 1-2 godziny.',
      longDescription:
        'Każda salka wyposażona jest w laptopa, naglośnienie oraz stół z krzesłami',
    },
    {
      name: '3-4 godziny',
      price: 15,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 3-4 godziny.',
      longDescription:
        'Każda salka wyposażona jest w laptopa, naglośnienie oraz stół z krzesłami',
    },
    {
      name: '5-6 godzin',
      price: 14,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 5-6 godzin.',
      longDescription:
        'Każda salka wyposażona jest w laptopa, naglośnienie oraz stół z krzesłami',
    },
    {
      name: '7+ godzin',
      price: 13,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 7+ godzin.',
      longDescription:
        'Każda salka wyposażona jest w laptopa, naglośnienie oraz stół z krzesłami',
    },
  ];

  vipRooms: IServices[] = [
    {
      name: '1-2 godziny',
      price: 20,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 1-2 godziny.',
      longDescription:
        'Salka Jotunheim (VIP) wyposażona jest w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
    {
      name: '3-4 godziny',
      price: 19,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 3-4 godziny.',
      longDescription:
        'Salka Jotunheim (VIP) wyposażona jest w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
    {
      name: '5-6 godzin',
      price: 18,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 5-6 godzin.',
      longDescription:
        'Salka Jotunheim (VIP) wyposażona jest w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
    {
      name: '7+ godzin',
      price: 17,
      priceType: 'hour',
      shortDescription:
        'Koszt jednej godziny wynajmu salki przez jedną osobę, przy wynajmie trwającym 7+ godzin.',
      longDescription:
        'Salka Jotunheim (VIP) wyposażona jest w laptopa, nagłośnienie oraz wygodne fotele i funkcjonalne stoliki podręczne.',
    },
  ];

  passes: IServices[] = [
    {
      name: 'Karnet Legendy Ragnarok',
      price: 260,
      priceType: 'piece',
      shortDescription:
        '20 godzin do wykorzystania + 4 dodatkowe godziny gratis.',
      longDescription:
        'Karnet Legendy Ragnarok oferuje 20 godzin dla okaziciela w standardowej salce, wyposażonej w laptopa, nagłośnienie, stół i krzesła. Dodatkowo w ramach oferty otrzymujesz 4 godziny gratis, aby w pełni wykorzystać potencjał naszych przestrzeni.',
    },
    {
      name: 'Karnet Legendy Ragnarok VIP',
      price: 340,
      priceType: 'piece',
      shortDescription:
        '20 godzin w salce VIP + 4 dodatkowe godziny w salce VIP gratis.',
      longDescription:
        'Karnet Legendy Ragnarok VIP oferuje 20 godzin dla okaziciela w ekskluzywnej salce VIP, wyposażonej w wygodne fotele, funkcjonalne stoliki podręczne, laptopa i nagłośnienie. Dodatkowe 4 godziny gratis pozwalają cieszyć się jeszcze dłuższym czasem w luksusowych warunkach.',
    },
    {
      name: 'Karnet Bogowie Ragnarok',
      price: 500,
      priceType: 'piece',
      shortDescription:
        '40 godzin do wykorzystania + 10 dodatkowych godzin gratis.',
      longDescription:
        'Karnet Bogowie Ragnarok zapewnia 40 godzin dla okaziciela w standardowej salce, wyposażonej w laptopa, nagłośnienie, stół i krzesła. Dodatkowe 10 godzin gratis pozwala na jeszcze większą elastyczność i komfort użytkowania przestrzeni.',
    },
    {
      name: 'Karnet Bogowie Ragnarok VIP',
      price: 650,
      priceType: 'piece',
      shortDescription:
        '40 godzin w salce VIP + 10 dodatkowych godzin w salce VIP gratis.',
      longDescription:
        'Karnet Bogowie Ragnarok VIP zapewnia 40 godzin dla okaziciela w przestronnej i komfortowej salce VIP, wyposażonej w wygodne fotele, funkcjonalne stoliki podręczne, laptopa i nagłośnienie. Dodatkowe 10 godzin gratis gwarantuje pełną swobodę i niezapomniane doświadczenia.',
    },
  ];

  additionalServices: IServices[] = [
    {
      name: 'Mistrz Gry na życzenie',
      price: 50,
      priceType: 'hour',
      shortDescription:
        'Godzina sesji z Mistrzem Gry - sprawdź dostępność naszych Mistrzów Gry oraz systemy, które prowadzą. Cena nie uwzględnia kosztu rezerwacji salki i jest naliczana niezależnie od wielkości drużyny.',
      longDescription:
        'Koszt obejmuje jedną godzinę sesji z naszym Mistrzem Gry w wybrany przez Ciebie system. W cenie jest przygotowanie sesji, fabuły, dodatków itp. Na życzenie Mistrz Gry stworzy postacie samodzielnie, albo w ramach wykupionego czasu, stworzycie je wspólnie.',
    },
  ];

  openRules(type: 'pass' | 'rent') {
    const modalRef = this.modalService.open(RegulationsComponent, {
      size: 'lg',
    });
    modalRef.componentInstance.type = type;
  }
}
