import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  NgbModal,
  NgbProgressbarModule,
  NgbToastModule,
} from '@ng-bootstrap/ng-bootstrap';
import { fromEvent, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MessageModalComponent } from '../../common/message-modal/message-modal.component';
import { OverlayService } from '../../core/services/overlay.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SendGridService } from '../../core/services/send-grid/send-grid.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { MapComponent } from '../../common/map/map.component';

type LatLngLiteral = { lat: number; lng: number };

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbToastModule,
    NgbProgressbarModule,
    MapComponent,
  ],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent implements OnInit, OnDestroy {
  // DI
  private readonly modalService = inject(NgbModal);
  private readonly overlayService = inject(OverlayService);
  private readonly sendGridService = inject(SendGridService);
  private readonly fb = inject(FormBuilder);
  private readonly platform = inject(PlatformService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  // Map — przekazywane do <app-map>
  readonly mapCenter = signal<LatLngLiteral>({
    lat: 52.39693009077769,
    lng: 16.92630935511027,
  });
  readonly mapZoom = signal<number>(17);
  readonly mapId = signal<string>('Ragnarok');
  readonly showMarker = signal<boolean>(true);
  readonly mapHeight = signal<number>(300);

  // Formularz
  readonly topics = [
    'Rezerwacja salki',
    'Zapytanie o towar',
    'Organizacja eventu',
    'Ogólne',
  ];

  readonly contactForm = this.fb.group({
    topic: [this.topics[0]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    company: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    message: ['', Validators.required],
  });

  // UI
  readonly isSmallScreen = signal(false);
  readonly showToast = signal(false);
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');
  readonly progress = signal(100);
  private progressInterval: any;

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Kontakt');

    if (this.platform.isBrowser) {
      this.isSmallScreen.set(window.innerWidth < 576);

      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.isSmallScreen.set(window.innerWidth < 576));
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.progressInterval);
  }

  openModal(): void {
    if (!this.isSmallScreen()) return;
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

  onSubmit(): void {
    if (!this.contactForm.valid) return;

    this.overlayService.showLoader();

    const v = this.contactForm.value;
    const emailPayload = {
      to: 'ragnarok.rooms@gmail.com',
      subject: `Nowa wiadomość od ${v.firstName} ${v.lastName}`,
      message: `
Temat: ${v.topic}
Firma: ${v.company || 'Nie podano'}
Email: ${v.email}
Telefon: ${v.phone}
Wiadomość:
${v.message}
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
        error: (err) => {
          this.overlayService.hideLoader();
          console.error('Błąd podczas wysyłania e-maila:', err);
          this.showErrorToast(
            'Wystąpił problem z wysyłaniem wiadomości. Spróbuj ponownie później.'
          );
        },
      });
  }

  onReset(): void {
    this.contactForm.reset({ topic: this.topics[0] });
  }

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

  private startProgressBar(): void {
    this.progress.set(100);
    const intervalTime = 50;
    const totalSteps = 5000 / intervalTime;
    const progressStep = 100 / totalSteps;

    this.progressInterval = setInterval(() => {
      this.progress.set(this.progress() - progressStep);
      if (this.progress() <= 0) this.closeToast();
    }, intervalTime);
  }

  closeToast(): void {
    this.showToast.set(false);
    clearInterval(this.progressInterval);
  }
}
