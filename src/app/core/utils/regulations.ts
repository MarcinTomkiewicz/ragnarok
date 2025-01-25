// regulations-data.ts
export const REGULATIONS = [
    {
      title: 'Regulamin Wynajmowania Pomieszczeń w Lokalu "Ragnarok"',
      sections: [
        {
          title: '§1 Postanowienia ogólne',
          content: [
            'Regulamin określa zasady korzystania z pomieszczeń dostępnych w lokalu "Ragnarok".',
            'Rezerwacja i korzystanie z pomieszczeń oznacza akceptację niniejszego regulaminu przez wszystkich użytkowników.',
            'Lokal przeznaczony jest do użytku zgodnie z jego charakterem, tj. spotkań związanych z grami RPG, planszowymi oraz innymi aktywnościami towarzyskimi.'
          ]
        },
        {
          title: '§2 Rezerwacja i korzystanie z pomieszczeń',
          content: [
            'Rezerwacje można odwołać najpóźniej na 2 godziny przed planowanym terminem, aby uzyskać zwrot opłaty za rezerwację. W przypadku późniejszego odwołania opłata za rezerwację przepada.',
            'W przypadku spóźnienia użytkownika:',
            '- Rezerwacja przepada po 30 minutach od wyznaczonej godziny rozpoczęcia, jeśli użytkownik nie poinformował obsługi o spóźnieniu.',
            '- Poinformowanie o spóźnieniu nie powoduje wydłużenia godzin rezerwacji ani zmniejszenia należnej opłaty — czas wynajmu kończy się zgodnie z pierwotnym harmonogramem.',
            'Lokal zastrzega sobie prawo do odmowy rezerwacji bez podania przyczyny.'
          ]
        },
        {
          title: '§3 Zasady zachowania w lokalu',
          content: [
            'Użytkownicy są zobowiązani do korzystania z pomieszczeń i wyposażenia zgodnie z ich przeznaczeniem.',
            'Wszelkie uszkodzenia sprzętu, wyposażenia lub pomieszczeń powstałe z winy użytkowników muszą zostać naprawione na ich koszt lub pokryte w formie odszkodowania.',
            'Na terenie lokalu obowiązuje:',
            '- Zakaz spożywania alkoholu.',
            '- Zakaz palenia wyrobów tytoniowych oraz używania e-papierosów.',
            '- Zakaz wnoszenia i spożywania substancji odurzających.',
            'Osoby nietrzeźwe lub pod wpływem innych substancji psychoaktywnych nie będą obsługiwane i mogą zostać poproszone o opuszczenie lokalu.'
          ]
        },
        {
          title: '§4 Odpowiedzialność i ograniczenia',
          content: [
            'Lokal nie ponosi odpowiedzialności za zgubione lub pozostawione przedmioty.',
            'Osoby niepełnoletnie mogą przebywać w lokalu wyłącznie w godzinach otwarcia lokalu (12:00–23:00).',
            'W przypadku zachowań zakłócających porządek lub przeszkadzających innym użytkownikom, obsługa lokalu ma prawo podjąć odpowiednie działania, w tym poprosić o opuszczenie lokalu.'
          ]
        },
        {
          title: '§5 Dodatkowe postanowienia',
          content: [
            'Użytkownicy mogą wnosić własne jedzenie i napoje pod warunkiem, że po zakończeniu wynajmu pomieszczenie zostanie pozostawione w czystości.',
            'Lokal może wprowadzić dodatkowe opłaty za sprzątanie w przypadku rażącego naruszenia zasad porządku.',
            'W lokalu obowiązuje zakaz odtwarzania głośnej muzyki, chyba że jest to częścią zaplanowanego wydarzenia i zostało wcześniej uzgodnione z obsługą.',
            'Wszelkie sprawy sporne rozstrzyga obsługa lokalu, której decyzje są ostateczne.'
          ]
        },
        {
          title: '§6 Postanowienia końcowe',
          content: [
            'Regulamin obowiązuje od dnia jego opublikowania w lokalu i na stronie internetowej "Ragnarok".',
            'Lokal zastrzega sobie prawo do zmiany regulaminu. Użytkownicy będą informowani o zmianach na co najmniej 14 dni przed ich wejściem w życie.'
          ]
        }
      ]
    },
    {
      title: 'Regulamin Programu „Dziedzictwo Ragnarok”',
      sections: [
        {
          title: '§1 Postanowienia Ogólne',
          content: [
            'Karnety „Dziedzictwo Ragnarok” są dostępne w czterech wariantach:',
            '- Karnet Legendy Ragnarok – zakup 20 godzin z góry, dodatkowe 4 godziny do wykorzystania.',
            '- Karnet Legendy Ragnarok VIP – zakup 20 godzin w salce VIP z góry, dodatkowe 4 godziny do wykorzystania w salce VIP.',
            '- Karnet Bogowie Ragnarok – zakup 40 godzin z góry, dodatkowe 10 godzin do wykorzystania.',
            '- Karnet Bogowie Ragnarok VIP – zakup 40 godzin w salce VIP z góry, dodatkowe 10 godzin do wykorzystania w salce VIP.'
          ]
        },
        {
          title: '§2 Zasady Korzystania z Karnetu',
          content: [
            'Karnet uprawnia do korzystania z salek standardowych lub VIP (zgodnie z rodzajem Karnetu) w wymiarze godzinowym określonym na Karnecie.',
            'Zarówno godziny opłacone z góry, jak i godziny dodatkowe (darmowe) będą oznaczane na Karnecie.',
            'Karnet nie musi być wykorzystany w całości podczas jednej rezerwacji – godziny mogą być używane w podziale na kilka rezerwacji.',
            'Jeśli rezerwacja obejmuje więcej godzin niż pozostało na Karnecie (opłaconych lub darmowych), nadwyżka godzin zostanie naliczona zgodnie z faktyczną liczbą godzin gry i obowiązującym Cennikiem.',
            'Przykład: Jeśli na Karnecie pozostały 4 godziny, a rezerwacja jest na 6 godzin, pozostałe 2 godziny zostaną naliczone zgodnie ze stawką dla rezerwacji 6-godzinnej.'
          ]
        },
        {
          title: '§3 Ograniczenia Korzystania z Karnetów',
          content: [
            'Jeden Karnet może być wykorzystany tylko raz na jedną grupę podczas jednej rezerwacji.',
            'Nie można łączyć dwóch lub więcej Karnetów do wykorzystania na jedną rezerwację.',
            'Godziny z Karnetu nie mogą być łączone z promocjami, voucherami, rabatami ani innymi programami lojalnościowymi.',
            'Karnet Legendy Ragnarok może być wykorzystany wyłącznie w salce standardowej, a Karnet Legendy Ragnarok VIP – wyłącznie w salce VIP. To samo dotyczy Karnetów Bogowie Ragnarok i Bogowie Ragnarok VIP.',
            'Karnety nie mogą być wykorzystywane podczas oficjalnych eventów prowadzonych przez Ragnarok ani podczas eventów organizowanych przez zewnętrznych partnerów, odbywających się w Ragnarok.'
          ]
        },
        {
          title: '§4 Utrata i Odpowiedzialność za Karnet',
          content: [
            'Ragnarok nie ponosi odpowiedzialności za zgubione, uszkodzone ani w inny sposób utracone Karnety.',
            'W przypadku utraty Karnetu, niewykorzystane godziny przepadają, a Klientowi nie przysługuje żadna forma rekompensaty.'
          ]
        },
        {
          title: '§5 Postanowienia Końcowe',
          content: [
            'Ragnarok zastrzega sobie prawo do weryfikacji prawidłowości korzystania z Karnetów i odmowy realizacji Karnetu w przypadku podejrzenia nadużyć.',
            'Regulamin Karnetów może ulec zmianie w dowolnym momencie, przy czym wszelkie zmiany będą publikowane na stronie internetowej lub w siedzibie Ragnarok.',
            'Zakup Karnetu oznacza akceptację niniejszego Regulaminu.'
          ]
        }
      ]
    },
    {
      title: 'Regulamin korzystania z voucherów na darmowe godziny gry w Ragnarok',
      sections: [
        {
          title: '§1 Postanowienia ogólne',
          content: [
            'Voucher uprawnia do darmowego korzystania z salek standardowych przez liczbę godzin określoną na voucherze.',
            'Voucher nie podlega wymianie na ekwiwalent pieniężny ani na inne usługi lub produkty.',
            'Voucher można wykorzystać jedynie w Ragnarok, zgodnie z niniejszym regulaminem.',
          ],
        },
        {
          title: '§2 Zasady korzystania z voucherów',
          content: [
            'Jeden voucher można wykorzystać wyłącznie w ramach jednej rezerwacji.',
            'Na jedną rezerwację można użyć tylko jednego vouchera, niezależnie od liczby graczy w grupie.',
            'Voucher może zostać użyty tylko na rezerwację salek standardowych i nie obejmuje wynajmu sali VIP.',
          ],
        },
        {
          title: '§3 Rezerwacje dłuższe niż czas przewidziany w voucherze',
          content: [
            'W przypadku rezerwacji przekraczającej liczbę godzin przewidzianą w voucherze, pozostały czas będzie naliczany zgodnie z faktycznym czasem gry i obowiązującym cennikiem.',
            'Koszt całej rezerwacji będzie liczony w oparciu o cenę wynikającą z całkowitego czasu gry, pomniejszoną o liczbę darmowych godzin wynikających z vouchera.',
            'Przykład: Jeśli grupa rezerwuje salę na 5 godzin, z czego 2 godziny pokrywa voucher, opłata za pozostałe 3 godziny zostanie naliczona zgodnie z ceną za 5 godzin gry.',
          ],
        },
        {
          title: '§4 Ograniczenia i wyłączenia',
          content: [
            'Voucher nie łączy się z innymi promocjami, rabatami, kartami lojalnościowymi ani karnetami.',
            'Godziny wykorzystane w ramach vouchera nie są doliczane do karty lojalnościowej i nie uprawniają do zbierania dodatkowych godzin w ramach programów lojalnościowych.',
            'Voucher nie może być stosowany do rezerwacji sali VIP ani innych usług dodatkowych, takich jak wynajem Mistrza Gry (MG).',
          ],
        },
        {
          title: '§5 Rezerwacja i kontakt',
          content: [
            'Aby zarezerwować salę z użyciem vouchera, należy skontaktować się z obsługą Ragnarok z odpowiednim wyprzedzeniem i poinformować o zamiarze skorzystania z vouchera.',
            'Obsługa ma prawo odmówić przyjęcia vouchera w przypadku braku dostępności salek standardowych w wybranym terminie.',
          ],
        },
        {
          title: '§6 Postanowienia końcowe',
          content: [
            'Ragnarok zastrzega sobie prawo do zmiany niniejszego regulaminu w dowolnym czasie.',
            'W przypadku pytań lub wątpliwości dotyczących korzystania z voucherów prosimy o kontakt z obsługą Ragnarok.',
          ],
        },
      ],
    },
    {
      title: 'Regulamin Programu Lojalnościowego „Ragnarok - Wojownicy”',
      sections: [
        {
          title: '§1 Postanowienia ogólne',
          content: [
            'Program Lojalnościowy „Ragnarok - Wojownicy” obejmuje dwie osobne kategorie: Karty Lojalnościowe dla salek standardowych („Karta Wojownicy”) oraz Karty Lojalnościowe dla salek VIP („Karta Legendarni Wojownicy”).',
            'Udział w Programie Lojalnościowym jest bezpłatny i dobrowolny.',
            'Karta Lojalnościowa przyznawana jest na życzenie Klienta podczas pierwszej rezerwacji w Ragnarok.',
          ],
        },
        {
          title: '§2 Zasady zbierania pieczątek',
          content: [
            'Każda pełna, opłacona godzina gry w salce standardowej uprawnia do otrzymania jednej pieczątki na Karcie Wojownicy.',
            'Każda pełna, opłacona godzina gry w salce VIP uprawnia do otrzymania jednej pieczątki na Karcie Legendarni Wojownicy.',
            'Pieczątki są przyznawane wyłącznie po uregulowaniu płatności za czas gry.',
            'Pieczątki nie są przyznawane za godziny objęte promocjami, rabatami, voucherami ani za darmowe godziny wynikające z Programu Lojalnościowego lub innych ofert.',
            'Pieczątki nie są przyznawane za godziny wykorzystane i opłacone podczas oficjalnych eventów w Ragnarok.',
            'Pieczątki nie są przyznawane za wynajem sal na cele inne niż gra (np. prelekcje, eventy prywatne).',
          ],
        },
        {
          title: '§3 Korzyści wynikające z Programu',
          content: [
            'Po zebraniu 20 pieczątek na jednej Karcie Lojalnościowej Klient otrzymuje prawo do skorzystania z 3 darmowych godzin gry.',
            'W przypadku Karty Wojownicy – darmowe godziny można wykorzystać w salce standardowej.',
            'W przypadku Karty Legendarni Wojownicy – darmowe godziny można wykorzystać w salce VIP.',
            'Darmowe godziny można wykorzystać jednorazowo lub w podziale na kilka rezerwacji – każda wykorzystana godzina będzie oznaczona na Karcie Lojalnościowej.',
            'W przypadku rezerwacji dłuższej niż liczba dostępnych darmowych godzin pozostały czas zostanie naliczony zgodnie z faktycznym czasem gry i obowiązującym cennikiem, po uwzględnieniu darmowych godzin.',
          ],
        },
        {
          title: '§4 Ograniczenia korzystania z darmowych godzin',
          content: [
            'Z jednej Karty Lojalnościowej można skorzystać tylko raz na jedną grupę podczas jednej rezerwacji.',
            'Darmowe godziny wynikające z Programu Lojalnościowego:',
            '- Nie mogą być łączone z voucherami, promocjami, rabatami ani innymi zniżkami.',
            '- Nie mogą być wymieniane na ekwiwalent pieniężny ani na godziny w salce innej niż wskazana w odpowiedniej karcie (Wojownicy lub Legendarni Wojownicy).',
            'Darmowe godziny muszą być zarezerwowane z wyprzedzeniem i zgłoszone podczas składania rezerwacji.',
          ],
        },
        {
          title: '§5 Ważność i przechowywanie Kart Lojalnościowych',
          content: [
            'Karty Lojalnościowe są ważne bezterminowo, jednak Ragnarok zastrzega sobie prawo do zmiany zasad Programu z miesięcznym wyprzedzeniem.',
            'W przypadku zgubienia Karty Lojalnościowej zgromadzone pieczątki przepadają i nie podlegają odtworzeniu.',
          ],
        },
        {
          title: '§6 Postanowienia końcowe',
          content: [
            'Ragnarok zastrzega sobie prawo do weryfikacji korzystania z Kart Lojalnościowych i odmowy przyznania darmowych godzin w przypadku podejrzenia nadużyć.',
            'Regulamin Programu Lojalnościowego może ulec zmianie w dowolnym momencie, przy czym wszelkie zmiany będą publikowane na stronie internetowej lub w siedzibie Ragnarok.',
            'Uczestnik Programu akceptuje niniejszy regulamin poprzez skorzystanie z Karty Lojalnościowej.',
          ],
        },
      ],
    }
  ];
  