import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

import { EventHostsService } from '../../core/services/event-hosts/event-hosts.service';
import { IEventHost } from '../../core/interfaces/i-event-host';
import { IRPGSystem } from '../../core/interfaces/i-rpg-system';
import { HostSignupScope } from '../../core/enums/events';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { BackendService } from '../../core/services/backend/backend.service';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { GmStyleTagLabels } from '../../core/enums/gm-styles';
import { GmDetailsModalComponent } from '../gm-details-modal/gm-details-modal.component';
import { EventSessionDetailsModalComponent } from '../event-session-details-modal/event-session-details-modal.component';

type HostVM = IEventHost & {
  system?: IRPGSystem | null;
  imageUrl?: string | null;
  // nazwa do listy – dla STAFF spróbujemy dociągnąć z profilu GMa (lazy w modalu)
  displayName?: string | null;
};

@Component({
  selector: 'app-event-hosts-list',
  standalone: true,
  imports: [CommonModule, NgbModalModule],
  templateUrl: './event-hosts-list.component.html',
  styleUrls: ['./event-hosts-list.component.scss'],
})
export class EventHostsListComponent implements OnChanges {
  private readonly hosts = inject(EventHostsService);
  private readonly images = inject(ImageStorageService);
  private readonly backend = inject(BackendService);
  private readonly modal = inject(NgbModal);

  /** Id wydarzenia */
  @Input({ required: true }) eventId!: string;
  /** Data (YYYY-MM-DD), którą steruje parent (najbliższa / wskazana) */
  @Input({ required: true }) dateIso!: string;

  // stan
  readonly loadingSig = signal<boolean>(true);
  readonly errorSig = signal<string | null>(null);
  readonly itemsSig = signal<HostVM[]>([]);

  readonly hasItems = computed(() => (this.itemsSig()?.length ?? 0) > 0);

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.eventId || !this.dateIso) return;
    this.fetch();
  }

  private fetch() {
    this.loadingSig.set(true);
    this.errorSig.set(null);
    this.itemsSig.set([]);

    this.hosts.getHostsWithSystems(this.eventId, this.dateIso).subscribe({
      next: (rows) => {
        const mapped: HostVM[] = rows.map((r: any) => {
          const system: IRPGSystem | null = r.systems ?? null; // join: systems(*)
          const imageUrl = r.imagePath
            ? this.images.getOptimizedPublicUrl(r.imagePath, 768, 512)
            : null;
          return { ...(r as IEventHost), system, imageUrl };
        });
        this.itemsSig.set(mapped);
      },
      error: () => this.errorSig.set('Nie udało się pobrać listy prowadzących.'),
      complete: () => this.loadingSig.set(false),
    });
  }

  openDetails(host: HostVM) {
    const ref = this.modal.open(EventSessionDetailsModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true,
    });
    ref.componentInstance.host = host;

    if (host.role === HostSignupScope.Staff && !host.displayName) {
      this.backend.getOneByFields<IGmData>('v_gm_directory', { userId: host.hostUserId }).subscribe({
        next: (gm) => {
          if (gm) {
            host.displayName = this.gmDisplayName(gm);
            ref.componentInstance.hostDisplayName = host.displayName;
            ref.componentInstance.gm = gm;
          }
        },
        error: () => void 0,
      });
    }
  }

  openGmProfile(host: HostVM, event: MouseEvent) {
    event.stopPropagation();
    if (host.role !== HostSignupScope.Staff) return;

    this.backend.getOneByFields<IGmData>('v_gm_directory', { userId: host.hostUserId }).subscribe({
      next: (gm) => {
        if (!gm) return;
        const ref = this.modal.open(GmDetailsModalComponent, { size: 'lg', centered: true, scrollable: true });
        ref.componentInstance.gm = gm;
      },
      error: () => void 0,
    });
  }

  listDisplayName(host: HostVM): string {
    if (host.displayName) return host.displayName;
    if (host.role === HostSignupScope.Staff) return 'Prowadzący (staff)';
    return 'Prowadzący';
  }

  private gmDisplayName(gm: IGmData): string {
    return gm.useNickname && gm.nickname ? gm.nickname : gm.firstName || 'Prowadzący';
  }

  GmStyleTagLabels = GmStyleTagLabels;
  HostSignupScope = HostSignupScope;
}
