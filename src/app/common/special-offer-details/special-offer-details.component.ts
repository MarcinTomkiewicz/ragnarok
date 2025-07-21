import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BackendService } from '../../core/services/backend/backend.service';
import { DomSanitizer } from '@angular/platform-browser';
import { ISpecial } from '../../core/interfaces/i-special';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RegulationsComponent } from '../../components/regulations/regulations.component';

@Component({
  selector: 'app-special-offer-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './special-offer-details.component.html',
  styleUrl: './special-offer-details.component.scss',
})
export class SpecialOfferDetailsComponent implements OnInit {
  private backend = inject(BackendService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private readonly modalService = inject(NgbModal);

  offer = signal<ISpecial | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;

    this.backend.getById<ISpecial>('specials', id).subscribe({
      next: (data) => {
        this.offer.set(data);
      },
      error: (err) => console.error('Błąd podczas ładowania oferty:', err),
    });
  }

  sanitize(url: string) {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  sanitizeMultiline(text: string): string {
    return text.replace(/\n/g, '<br />');
  }

  openRules(type: 'loyalty' | 'voucher' | 'special') {
    const modalRef = this.modalService.open(RegulationsComponent, {
      size: 'lg',
    });
    modalRef.componentInstance.type = type;
  }
}
