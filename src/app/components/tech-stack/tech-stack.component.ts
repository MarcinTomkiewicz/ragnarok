import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackendService } from '../../core/services/backend/backend.service';
import { LoaderService } from '../../core/services/loader/loader.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { CoworkerRoles, RoleDisplay } from '../../core/enums/roles';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { LoaderComponent } from '../../common/loader/loader.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GmDetailsModalComponent } from '../../common/gm-details-modal/gm-details-modal.component';

@Component({
  selector: 'app-tech-stack',
  standalone: true,
  imports: [CommonModule, LoaderComponent],
  templateUrl: './tech-stack.component.html',
  styleUrl: './tech-stack.component.scss',
})
export class TechStackComponent implements OnInit {
  private readonly backend = inject(BackendService);
  private readonly loader = inject(LoaderService);
  private readonly platform = inject(PlatformService);
  private readonly seo = inject(SeoService);
  private readonly modal = inject(NgbModal);

  readonly gms = signal<IGmData[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showAll = signal(false);

  readonly visibleGms = computed(() =>
    this.showAll() ? this.gms() : this.gms().slice(0, 4)
  );

  readonly shouldShowMoreButton = computed(() => {    
    return !this.showAll() && this.gms().length > 4
  }
  );

  readonly roleDisplay = RoleDisplay[CoworkerRoles.Gm];

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Nasi Mistrzowie Gry');
    if (this.platform.isBrowser) {
      this.loadData();
    }
  }

  private loadData(): void {
    this.loader.show();
    this.backend
      .getAll<IGmData>('v_gm_specialties_with_user', 'gmProfileCreatedAt', 'asc')
      .subscribe({
        next: (data) => {
          const uniqueByUser = this.deduplicateByUserId(data);
          this.gms.set(uniqueByUser);
          
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.error.set('Nie udało się pobrać danych.');
          this.isLoading.set(false);
        },
        complete: () => this.loader.hide(),
      });
  }

  private deduplicateByUserId(data: IGmData[]): IGmData[] {
    const map = new Map<string, IGmData>();
    for (const item of data) {
      if (!map.has(item.userId)) {
        map.set(item.userId, item);
      }
    }
    return Array.from(map.values());
  }

  onCardClick(gm: IGmData): void {
    const modalRef = this.modal.open(GmDetailsModalComponent, {
      size: 'lg',
      centered: true,
    });
    modalRef.componentInstance.gm = gm;
  }
}
