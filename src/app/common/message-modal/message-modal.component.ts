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
  @Input() message: string = '';
  public activeModal = inject(NgbActiveModal)
  private readonly fb = inject(FormBuilder);
  messageForm: FormGroup;
  result$: Subject<string> = new Subject<string>();

  constructor() {
    this.messageForm = this.fb.group({
      message: [this.message]
    });
  }

  onSubmit() {
    this.result$.next(this.messageForm.value.message);
    this.activeModal.close();
  }
}
