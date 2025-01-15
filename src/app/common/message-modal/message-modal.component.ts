import { Component, inject, Input } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-message-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './message-modal.component.html',
  styleUrl: './message-modal.component.scss'
})
export class MessageModalComponent {
  @Input() message: string = ''; // Odbieramy wiadomość z głównego komponentu
  public activeModal = inject(NgbActiveModal)
  private fb = inject(FormBuilder);
  messageForm: FormGroup;
  result$: Subject<string> = new Subject<string>(); // Subject jako Observable

  constructor() {
    this.messageForm = this.fb.group({
      message: [this.message]
    });
  }

  onSubmit() {
    this.result$.next(this.messageForm.value.message); // Emitujemy wiadomość do głównego komponentu
    this.activeModal.close(); // Zamykanie modala
  }
}
