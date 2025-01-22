import { CommonModule } from '@angular/common';
import { Component, inject, HostListener, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, Renderer2 } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal, NgbProgressbarModule, NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { MessageModalComponent } from '../../common/message-modal/message-modal.component';
import { take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { OverlayService } from '../../core/services/overlay.service';
import { SendGridService } from '../../core/services/send-grid/send-grid.service';
import { BackendService } from '../../core/services/backend/backend.service';

declare var google: any;

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbToastModule, NgbProgressbarModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, OnDestroy {
  contactForm: FormGroup;
  private readonly modalService = inject(NgbModal);
  private readonly overlayService = inject(OverlayService);
  private readonly http = inject(HttpClient);
  private readonly backendService = inject(BackendService);
  private readonly sendGridService = inject(SendGridService);
  private readonly fb = inject(FormBuilder);
  private readonly renderer = inject(Renderer2);
  topics = [
    'Rezerwacja salki',
    'Zapytanie o towar',
    'Organizacja eventu',
    'Ogólne'
  ];
  isSmallScreen = false;
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  progress = 100;
  progressInterval: any;
  toastDuration = 5000;

  constructor() {
    this.contactForm = this.fb.group({
      topic: [this.topics[0]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      company: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      message: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.checkScreenSize();
    window.addEventListener('resize', this.handleResize.bind(this));

  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 576;
  }

  openModal() {
    if (this.isSmallScreen) {
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

      const emailPayload = {
        to: 'ragnarok.rooms@gmail.com',
        subject: `Nowa wiadomość od ${this.contactForm.value.firstName} ${this.contactForm.value.lastName}`,
        message: `
          Temat: ${this.contactForm.value.topic}
          Firma: ${this.contactForm.value.company || 'Nie podano'}
          Email: ${this.contactForm.value.email}
          Telefon: ${this.contactForm.value.phone}
          Wiadomość:
          ${this.contactForm.value.message}
        `,
      };

      this.sendGridService.sendEmail(emailPayload.to, emailPayload.subject, emailPayload.message)
        .subscribe({
          next: () => {
            this.overlayService.hideLoader();
            this.showSuccessToast('Dziękujemy za wiadomość! Skontaktujemy się z Tobą wkrótce.');
            this.onReset();
          },
          error: (err: any) => {
            this.overlayService.hideLoader();
            console.error('Błąd podczas wysyłania e-maila:', err);
            this.showErrorToast('Wystąpił problem z wysłaniem wiadomości. Spróbuj ponownie później.');
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
    this.progress = 100;

    const intervalTime = 50;
    const totalSteps = this.toastDuration / intervalTime;

    const progressStep = 100 / totalSteps;

    this.progressInterval = setInterval(() => {
      this.progress -= progressStep;
      if (this.progress <= 0) {
        this.closeToast();
      }
    }, intervalTime);
  }

  closeToast() {
    this.showToast = false;
    clearInterval(this.progressInterval);
  }

  private loadGoogleMapsScript(): void {
    if (!document.getElementById('google-maps-script')) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyDiASRjUg6MXHh0K7Ct9U3TpaLtSfYZmIs&q&callback=initMap&libraries=maps,marker&v=beta';
      script.async = true;
      script.defer = true;

      // Ustawienie funkcji callback
      (window as any).initMap = this.initMap.bind(this);

      document.body.appendChild(script);
    } else {
      this.initMap();
    }
  }

  private initMap(): void {
    const map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
      center: { lat: 52.39698791503906, lng: 16.9263858795166 },
      zoom: 14,
      mapId: 'DEMO_MAP_ID'
    });

    new google.maps.marker.AdvancedMarkerElement({
      position: { lat: 52.39698791503906, lng: 16.9263858795166 },
      map,
      title: 'Ragnarok Rooms',
    });
  }
}
