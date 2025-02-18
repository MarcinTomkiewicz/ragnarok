import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  NgbModal,
  NgbProgressbarModule,
  NgbToastModule,
} from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { MessageModalComponent } from '../../common/message-modal/message-modal.component';
import { OverlayService } from '../../core/services/overlay.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SendGridService } from '../../core/services/send-grid/send-grid.service';
import { SeoService } from '../../core/services/seo/seo.service';

declare const google: any;

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbToastModule,
    NgbProgressbarModule,
  ],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ContactComponent implements AfterViewInit, OnDestroy {
  private readonly modalService = inject(NgbModal);
  private readonly overlayService = inject(OverlayService);
  private readonly sendGridService = inject(SendGridService);
  private readonly fb = inject(FormBuilder);
  private readonly platformService = inject(PlatformService);

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

  isSmallScreen = signal(false);
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  progress = signal(100);
  progressInterval: any;
  private readonly seo = inject(SeoService);

  constructor() {
    if (this.platformService.isBrowser) {
      this.isSmallScreen.set(window.innerWidth < 576);
      this.observeResize();
    }
  }

  ngOnInit() {
    this.seo.setTitleAndMeta('Kontakt');
  }

  ngAfterViewInit() {
    if (this.platformService.isBrowser) {
      this.loadGoogleMapsScript();
    }
  }

  ngOnDestroy() {
    clearInterval(this.progressInterval);
  }

  private observeResize(): void {
    if (!this.platformService.isBrowser) return;

    const resizeObserver = new ResizeObserver(() => {
      this.isSmallScreen.set(window.innerWidth < 576);
    });
    resizeObserver.observe(document.body);
  }

  openModal() {
    if (this.isSmallScreen()) {
      const modalRef = this.modalService.open(MessageModalComponent, {
        size: 'sm',
        centered: true,
      });
      modalRef.componentInstance.message =
        this.contactForm.get('message')?.value || '';

      modalRef.componentInstance.result$
        .pipe(take(1))
        .subscribe((result: string) => {
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

      this.sendGridService
        .sendEmail(emailPayload.to, emailPayload.subject, emailPayload.message)
        .subscribe({
          next: () => {
            this.overlayService.hideLoader();
            this.showSuccessToast(
              'Dziękujemy za wiadomość! Skontaktujemy się z Tobą wkrótce.'
            );
            this.onReset();
          },
          error: (err: any) => {
            this.overlayService.hideLoader();
            console.error('Błąd podczas wysyłania e-maila:', err);
            this.showErrorToast(
              'Wystąpił problem z wysyłaniem wiadomości. Spróbuj ponownie później.'
            );
          },
        });
    }
  }

  onReset() {
    this.contactForm.reset({ topic: this.topics[0] });
  }

  showSuccessToast(message: string) {
    this.showToast.set(true);
    this.toastMessage.set(message);
    this.toastType.set('success');
    this.startProgressBar();
  }

  showErrorToast(message: string) {
    this.showToast.set(true);
    this.toastMessage.set(message);
    this.toastType.set('error');
    this.startProgressBar();
  }

  startProgressBar() {
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

  closeToast() {
    this.showToast.set(false);
    clearInterval(this.progressInterval);
  }

  private loadGoogleMapsScript(): void {
    if (!document.getElementById('google-maps-script')) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src =
        'https://maps.googleapis.com/maps/api/js?key=AIzaSyDiASRjUg6MXHh0K7Ct9U3TpaLtSfYZmIs&q&callback=initMap&libraries=maps,marker&v=beta';
      script.async = true;
      script.defer = true;

      (window as any).initMap = this.initMap.bind(this);
      document.body.appendChild(script);
    } else {
      this.initMap();
    }
  }

  private initMap(): void {
    if (!this.platformService.isBrowser) return;

    const map = new google.maps.Map(
      document.getElementById('map') as HTMLElement,
      {
        center: { lat: 52.39698791503906, lng: 16.9263858795166 },
        zoom: 14,
        mapId: 'DEMO_MAP_ID',
      }
    );

    new google.maps.marker.AdvancedMarkerElement({
      position: { lat: 52.39698791503906, lng: 16.9263858795166 },
      map,
      title: 'Ragnarok Rooms',
    });
  }
}
