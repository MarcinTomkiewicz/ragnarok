import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { BackendService } from '../../core/services/backend/backend.service';
import { IRPGSystem } from '../../core/interfaces/i-rpg-system';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LinkifyPipe } from '../../core/pipes/linkify.pipe';
import { GmStyleTagLabels } from '../../core/enums/gm-styles';
import { GmService } from '../../auth/core/services/gm/gm.service';

@Component({
  selector: 'app-gm-details-modal',
  standalone: true,
  imports: [CommonModule, LinkifyPipe],
  templateUrl: './gm-details-modal.component.html',
  styleUrl: './gm-details-modal.component.scss',
})
export class GmDetailsModalComponent implements OnInit {
  @Input() gm!: IGmData;

  private readonly backend = inject(BackendService);
  private readonly gmService = inject(GmService);
  private readonly modal = inject(NgbActiveModal);

  readonly systems = signal<IRPGSystem[]>([]);
  readonly isLoading = signal(true);
  GmStyleTagLabels = GmStyleTagLabels;

  experienceParagraphs: string[] = [];

  ngOnInit(): void {
    this.backend.getAll<IGmData>('v_gm_specialties_with_user').subscribe({
      next: (records) => {
        const gmRecords = records.filter((r) => r.userId === this.gm.userId);

        const systemIdsOrdered = gmRecords.map((r) => r.systemId);

        this.backend
          .getByIds<IRPGSystem>('systems', systemIdsOrdered)
          .subscribe({
            next: (systemsData) => {
              const sorted = systemIdsOrdered
                .map((id) => systemsData.find((sys) => sys.id === id))
                .filter((sys): sys is IRPGSystem => !!sys);

              this.systems.set(sorted);
            },
            error: (err) =>
              console.error('Błąd podczas ładowania systemów:', err),
            complete: () => this.isLoading.set(false),
          });
      },
      error: (err) => {
        console.error('Błąd podczas pobierania profilu MG:', err);
        this.isLoading.set(false);
      },
    });
    if (this.gm.experience) {
      this.experienceParagraphs = this.gm.experience.split(/\n/);
    }
  }

  close(): void {
    this.modal.close();
  }

  gmDisplayName(gm: IGmData): string {
    return this.gmService.gmDisplayName(gm);
  }
}
