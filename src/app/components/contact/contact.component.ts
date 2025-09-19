import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { NgbModal, NgbProgressbarModule, NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { MessageModalComponent } from '../../common/message-modal/message-modal.component';
import { OverlayService } from '../../core/services/overlay.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SendGridService } from '../../core/services/send-grid/send-grid.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { MapComponent } from '../../common/map/map.component';

declare const google: any;

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbToastModule,
    NgbProgressbarModule,
    GoogleMapsModule,
    MapComponent
  ],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent implements OnDestroy {
  // Services
  private readonly modalService = inject(NgbModal);
  private readonly overlayService = inject(OverlayService);
  private readonly sendGridService = inject(SendGridService);
  private readonly fb = inject(FormBuilder);
  private readonly platformService = inject(PlatformService);
  private readonly seo = inject(SeoService);

  // Google Maps options and markers
  options: google.maps.MapOptions = {
    mapId: 'Ragnarok',
    center: { lat: 52.39693009077769, lng: 16.92630935511027 },
    zoom: 17,
  };

  markerPosition: google.maps.LatLngLiteral = { lat: 52.39693009077769, lng: 16.92630935511027 };
  markerOptions: google.maps.marker.AdvancedMarkerElementOptions = {
    position: this.markerPosition,
    content: this.createIcon(),
  };

  // Form properties
  topics = [
    'Rezerwacja salki',
    'Zapytanie o towar',
    'Organizacja eventu',
    'Ogólne',
  ];

  contactForm = this.fb.group({
    topic: [this.topics[0]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    company: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    message: ['', Validators.required],
  });

  // UI properties (signals)
  isSmallScreen = signal(false);
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  progress = signal(100);
  progressInterval: any;

  // Lifecycle hooks
  ngOnInit(): void {
    this.seo.setTitleAndMeta('Kontakt');
    if (this.platformService.isBrowser) {
      this.isSmallScreen.set(window.innerWidth < 576);
      this.observeResize();
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.progressInterval);
  }

  // Methods for handling window resizing
  private observeResize(): void {
    if (!this.platformService.isBrowser) return;

    const resizeObserver = new ResizeObserver(() => {
      this.isSmallScreen.set(window.innerWidth < 576);
    });
    resizeObserver.observe(document.body);
  }

  // Map Icon creation (only works on the client-side)
  private createIcon(): HTMLElement | null {
    if (!this.platformService.isBrowser) return null;

    const img = document.createElement('img');
    img.src = 'ragnarok.avif';
    img.style.backgroundColor = '#16140f';
    img.style.width = '50px';
    img.style.height = '50px';
    img.style.borderRadius = '100%';
    return img;
  }

  // Modal handling for small screens
  openModal(): void {
    if (this.isSmallScreen()) {
      const modalRef = this.modalService.open(MessageModalComponent, {
        size: 'sm',
        centered: true,
      });
      modalRef.componentInstance.message = this.contactForm.get('message')?.value || '';
      modalRef.componentInstance.result$
        .pipe(take(1))
        .subscribe((result: string) => {
          this.contactForm.patchValue({ message: result });
        });
    }
  }

  // Form submission handler
  onSubmit(): void {
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

      this.sendGridService.sendEmail(emailPayload.to, emailPayload.subject, emailPayload.message).subscribe({
        next: () => {
          this.overlayService.hideLoader();
          this.showSuccessToast('Dziękujemy za wiadomość! Skontaktujemy się z Tobą wkrótce.');
          this.onReset();
        },
        error: (err: any) => {
          this.overlayService.hideLoader();
          console.error('Błąd podczas wysyłania e-maila:', err);
          this.showErrorToast('Wystąpił problem z wysyłaniem wiadomości. Spróbuj ponownie później.');
        },
      });
    }
  }

  // Reset the form
  onReset(): void {
    this.contactForm.reset({ topic: this.topics[0] });
  }

  // Toast message handling
  showSuccessToast(message: string): void {
    this.showToast.set(true);
    this.toastMessage.set(message);
    this.toastType.set('success');
    this.startProgressBar();
  }

  showErrorToast(message: string): void {
    this.showToast.set(true);
    this.toastMessage.set(message);
    this.toastType.set('error');
    this.startProgressBar();
  }

  // Progress bar handling
  startProgressBar(): void {
    this.progress.set(100);
    const intervalTime = 50;
    const totalSteps = 5000 / intervalTime;
    const progressStep = 100 / totalSteps;

    this.progressInterval = setInterval(() => {
      this.progress.set(this.progress() - progressStep);
      if (this.progress() <= 0) {
        this.closeToast();
      }
    }, intervalTime);
  }

  closeToast(): void {
    this.showToast.set(false);
    clearInterval(this.progressInterval);
  }
}
