import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { EventHostsService } from '../../core/services/event-hosts/event-hosts.service';
import { IEventHost } from '../../core/interfaces/i-event-host';
import { IRPGSystem } from '../../core/interfaces/i-rpg-system';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { GmStyleTagLabels } from '../../core/enums/gm-styles';
import { GmDirectoryService } from '../../auth/core/services/gm/gm-directory/gm-directory.service';

import { GmDetailsModalComponent } from '../gm-details-modal/gm-details-modal.component';
import { EventSessionDetailsModalComponent } from '../event-session-details-modal/event-session-details-modal.component';

import { BackendService } from '../../core/services/backend/backend.service';
import { IContentTrigger } from '../../core/interfaces/i-content-trigger';
import { FilterOperator } from '../../core/enums/filterOperator';
import { HostSignupScope } from '../../core/enums/events';

type HostCardVM = IEventHost & {
  system?: IRPGSystem | null;
  imageUrl?: string | null;
  displayName?: string | null;
  gm?: IGmData | null;
  // te są już po mapowaniu na PL
  triggersTop: string[];
  triggersExtraCount: number;
};

@Component({
  selector: 'app-event-hosts-list',
  standalone: true,
  imports: [CommonModule, NgbModalModule],
  templateUrl: './event-hosts-list.component.html',
  styleUrls: ['./event-hosts-list.component.scss'],
})
export class EventHostsListComponent {
  // inputs
  eventId = input.required<string>();
  dateIso = input.required<string>();

  // DI
  private readonly hosts = inject(EventHostsService);
  private readonly images = inject(ImageStorageService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly backend = inject(BackendService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);

  // state
  readonly loadingSig = signal(true);
  readonly errorSig = signal<string | null>(null);
  readonly itemsSig = signal<HostCardVM[]>([]);
  readonly hasItems = computed(() => (this.itemsSig()?.length ?? 0) > 0);

  readonly HostRole = HostSignupScope;
  GmStyleTagLabels = GmStyleTagLabels;
  HostSignupScope = HostSignupScope;

  // --- słownik triggerów: slug -> label (PL), buforowany
  private readonly triggersMap$ = this.backend
    .getAll<IContentTrigger>(
      'content_triggers',
      'label',
      'asc',
      { filters: { is_active: { operator: FilterOperator.EQ, value: true } } } as any,
      undefined,
      undefined,
      false
    )
    .pipe(
      map((rows) => new Map<string, string>((rows ?? []).map((t) => [t.slug, t.label]))),
      catchError(() => of(new Map<string, string>())),
      shareReplay(1)
    );

  constructor() {
    const id$ = toObservable(this.eventId);
    const date$ = toObservable(this.dateIso);

    combineLatest([id$, date$])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(([id, date]) => !!id && !!date),
        distinctUntilChanged(([aId, aDate], [bId, bDate]) => aId === bId && aDate === bDate),
        tap(() => {
          this.loadingSig.set(true);
          this.errorSig.set(null);
          this.itemsSig.set([]);
        }),
        switchMap(([id, date]) =>
          // pobierz jednocześnie hostów i słownik triggerów
          combineLatest([
            this.hosts.getHostsWithSystems(id, date).pipe(catchError(() => of([]))),
            this.triggersMap$,
          ]).pipe(
            // zmapuj hostów -> VM + podmień triggery na labelki PL
            map(([rows, tmap]) => {
              const base = (rows ?? []).map((r: any) => {
                const system: IRPGSystem | null = r.systems ?? null;
                const imageUrl = r.imagePath
                  ? this.images.getOptimizedPublicUrl(r.imagePath, 768, 512)
                  : null;

                const slugs: string[] = (r.triggers ?? []) as string[];
                const topLabels = slugs.slice(0, 3).map((s) => tmap.get(s) ?? s);

                return {
                  ...(r as IEventHost),
                  system,
                  imageUrl,
                  displayName: null,
                  gm: null,
                  triggersTop: topLabels,
                  triggersExtraCount: Math.max(0, slugs.length - 3),
                } as HostCardVM;
              });

              const uniqueUserIds = Array.from(new Set(base.map((h) => h.hostUserId)));
              return { base, uniqueUserIds };
            }),
            // dociągnij GM/user dla każdego hostUserId
            switchMap(({ base, uniqueUserIds }) => {
              if (!uniqueUserIds.length) return of(base);
              return forkJoin(uniqueUserIds.map((id) => this.gmDirectory.getGmById(id))).pipe(
                map((gms) => {
                  const byId = new Map<string, IGmData | null>();
                  gms.forEach((gm) => gm && byId.set(gm.userId, gm));
                  return base.map((h) => {
                    const gm = byId.get(h.hostUserId) ?? null;
                    return {
                      ...h,
                      gm,
                      displayName: this.gmDirectory.gmDisplayName(gm),
                    } as HostCardVM;
                  });
                })
              );
            }),
            catchError(() => {
              this.errorSig.set('Nie udało się pobrać listy prowadzących.');
              return of([] as HostCardVM[]);
            }),
            finalize(() => this.loadingSig.set(false))
          )
        )
      )
      .subscribe((items) => this.itemsSig.set(items));
  }

  openDetails(host: HostCardVM) {
    const ref = this.modal.open(EventSessionDetailsModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true,
    });
    ref.componentInstance.host = host;
    ref.componentInstance.hostDisplayName = host.displayName ?? 'Prowadzący';
    if (host.role === HostSignupScope.Staff && host.gm) {
      ref.componentInstance.gm = host.gm;
    }
  }

  openGmProfile(host: HostCardVM, event: MouseEvent) {
    event.stopPropagation();
    if (host.role !== HostSignupScope.Staff) return;
    if (host.gm) {
      const ref = this.modal.open(GmDetailsModalComponent, { size: 'lg', centered: true, scrollable: true });
      ref.componentInstance.gm = host.gm;
      return;
    }
    this.gmDirectory
      .getGmById(host.hostUserId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((gm) => {
        if (!gm) return;
        const ref = this.modal.open(GmDetailsModalComponent, { size: 'lg', centered: true, scrollable: true });
        ref.componentInstance.gm = gm;
      });
  }

  listDisplayName(h: HostCardVM): string {
    return h.displayName || (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący');
  }
}
