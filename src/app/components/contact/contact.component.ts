import { CommonModule } from '@angular/common';
import { Component, inject, HostListener, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal, NgbProgressbarModule, NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { MessageModalComponent } from '../../common/message-modal/message-modal.component';
import { take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { OverlayService } from '../../core/services/overlay.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbToastModule, NgbProgressbarModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, OnDestroy {
  contactForm: FormGroup;
  modalService = inject(NgbModal);
  overlayService = inject(OverlayService);
  http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  topics = [
    'Rezerwacja salki',
    'Zapytanie o towar',
    'Organizacja eventu',
    'Ogólne'
  ];
  isSmallScreen = false;
  showToast = false; // Flaga do wyświetlania toastów
  toastMessage = ''; // Wiadomość dla toasta
  toastType: 'success' | 'error' = 'success'; // Typ toasta (sukces lub błąd)
  progress = 100; // Startujemy z pełnym postępem
  progressInterval: any;
  toastDuration = 5000; // Czas wyświetlania toasta w ms (5 sekund)

  constructor() {
    this.contactForm = this.fb.group({
      topic: [this.topics[0]], // domyślny temat
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      company: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      message: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.checkScreenSize(); // Sprawdź wielkość ekranu przy inicjalizacji
    window.addEventListener('resize', this.handleResize.bind(this)); // Dodaj nasłuchiwanie zmian rozmiaru okna
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.handleResize.bind(this)); // Usuń nasłuchiwanie przy niszczeniu komponentu
  }

  private handleResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 576; // Ustawia flagę na podstawie szerokości okna (<576px to Bootstrap XS)
  }

  openModal() {
    if (this.isSmallScreen) {  // Otwórz modal tylko na małych ekranach
      const modalRef = this.modalService.open(MessageModalComponent, {
        size: 'sm',
        centered: true,
      });

      modalRef.componentInstance.message = this.contactForm.get('message')?.value || '';

      modalRef.componentInstance.result$.pipe(take(1)).subscribe((result: string) => {
        this.contactForm.patchValue({ message: result });
      });
    }
  }

  onSubmit() {
    if (this.contactForm.valid) {
      this.overlayService.showLoader();
      this.http.post('http://localhost:1337/api/contact', this.contactForm.value).subscribe({
        next: (response) => {
          this.overlayService.hideLoader();
          this.showSuccessToast('Dziękujemy za wysłanie wiadomości. Skontaktujemy się z Państwem niebawem.');
          this.onReset();
        },
        error: (error) => {
          this.overlayService.hideLoader();
          this.showErrorToast('Niestety, nie udało się wysłać wiadomości. Prosimy spróbować ponownie później.');
        },
      });
    }
  }

  onReset() {
    this.contactForm.reset({
      topic: this.topics[0],
    });
  }

  showSuccessToast(message: string) {
    this.showToast = true;
    this.toastMessage = message;
    this.toastType = 'success';
    this.startProgressBar();
  }

  showErrorToast(message: string) {
    this.showToast = true;
    this.toastMessage = message;
    this.toastType = 'error';
    this.startProgressBar();
  }

  startProgressBar() {
    this.progress = 100; // Ustawiamy pasek na 100%

    const intervalTime = 50; // Odświeżanie co 50ms dla płynnej animacji
    const totalSteps = this.toastDuration / intervalTime; // Ilość kroków animacji

    const progressStep = 100 / totalSteps; // Jak dużo zmniejszać na krok

    this.progressInterval = setInterval(() => {
      this.progress -= progressStep; // Zmniejszamy postęp
      if (this.progress <= 0) {
        this.closeToast();
      }
    }, intervalTime);
  }

  closeToast() {
    this.showToast = false;
    clearInterval(this.progressInterval); // Zatrzymujemy interval
  }
}
