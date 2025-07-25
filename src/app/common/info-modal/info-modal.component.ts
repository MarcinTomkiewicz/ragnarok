import { Component, computed, inject, Input, input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-info-modal',
  standalone: true,
  imports: [],
  templateUrl: './info-modal.component.html',
  styleUrl: './info-modal.component.scss',
})
export class InfoModalComponent {
  @Input() header = 'Informacja';
  @Input() message = ''
  @Input() showCancel = false

  readonly activeModal = inject(NgbActiveModal);

  close(): void {
    this.activeModal.close(true);
  }

  confirm(): void {
    this.activeModal.close(true);
  }

  dismiss(): void {
    this.activeModal.dismiss('cancel');
  }
}
