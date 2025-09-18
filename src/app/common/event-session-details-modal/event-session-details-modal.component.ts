import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { IEventHost } from '../../core/interfaces/i-event-host';
import { IRPGSystem } from '../../core/interfaces/i-rpg-system';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { GmStyleTagLabels } from '../../core/enums/gm-styles';
import { HostSignupScope } from '../../core/enums/events';

import { BackendService } from '../../core/services/backend/backend.service';
import { FilterOperator } from '../../core/enums/filterOperator';
import { IContentTrigger } from '../../core/interfaces/i-content-trigger';

@Component({
  selector: 'app-event-session-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-session-details-modal.component.html',
  styleUrls: ['./event-session-details-modal.component.scss'],
})
export class EventSessionDetailsModalComponent implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly backend = inject(BackendService);

  @Input() host!: IEventHost & { system?: IRPGSystem | null; imageUrl?: string | null };
  @Input() hostDisplayName: string | null = null;
  @Input() gm: IGmData | null = null;

  // opcjonalnie – jeśli parent ma już mapę slug->label, może ją wstrzyknąć, a my nie będziemy robić fetch
  @Input() triggersMap: Record<string, string> | null = null;

  descriptionParagraphs: string[] = [];

  GmStyleTagLabels = GmStyleTagLabels;
  HostSignupScope = HostSignupScope;

  ngOnInit(): void {
    const raw = (this.host?.description ?? '').replace(/\r\n/g, '\n');
    this.descriptionParagraphs = raw.split('\n');

    if (!this.triggersMap || !Object.keys(this.triggersMap).length) {
      // dociągamy aktywne triggery i budujemy mapę { slug: labelPL }
      this.backend
        .getAll<IContentTrigger>(
          'content_triggers',
          'label',
          'asc',
          { filters: { is_active: { operator: FilterOperator.EQ, value: true } } } as any,
          undefined,
          undefined,
          false
        )
        .subscribe({
          next: (rows) => {
            this.triggersMap = (rows ?? []).reduce<Record<string, string>>((acc, t) => {
              acc[t.slug] = t.label;
              return acc;
            }, {});
          },
          error: () => {
            this.triggersMap = this.triggersMap ?? {};
          },
        });
    }
  }

  triggerLabel = (slug: string): string =>
    (this.triggersMap && this.triggersMap[slug]) || slug;

  close() { this.activeModal.close(); }
}
