import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { IEventHost } from '../../core/interfaces/i-event-host';
import { IRPGSystem } from '../../core/interfaces/i-rpg-system';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { GmStyleTagLabels } from '../../core/enums/gm-styles';
import { HostSignupScope } from '../../core/enums/events';

@Component({
  selector: 'app-event-session-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-session-details-modal.component.html',
  styleUrls: ['./event-session-details-modal.component.scss'],
})
export class EventSessionDetailsModalComponent {
  private readonly activeModal = inject(NgbActiveModal);

  @Input() host!: IEventHost & { system?: IRPGSystem | null; imageUrl?: string | null };
  @Input() hostDisplayName: string | null = null;
  @Input() gm: IGmData | null = null;

  GmStyleTagLabels = GmStyleTagLabels;
  HostSignupScope = HostSignupScope;

  close() { this.activeModal.close(); }
}
