import { Component, computed, inject, input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-info-modal',
  standalone: true,
  imports: [],
  templateUrl: './info-modal.component.html',
  styleUrl: './info-modal.component.scss',
})
export class InfoModalComponent {
  header = input<string>('');
  message = input<string>('');
  currentHeader = computed(() => this.header ? this.header : 'Informacja');
  currentMessage = computed(() => this.message);
  public activeModal = inject(NgbActiveModal);

  ngOnInit(): void {
    console.log(this.header, this.message, this.currentHeader());
    
  }

  close(): void {
    this.activeModal.close();
  }
}
