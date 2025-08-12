import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { IGmData } from '../../../core/interfaces/i-gm-profile';

export interface ISuggestedSlot {
  date: string;         // 'YYYY-MM-DD'
  startHour: number;    // 17..22
  duration: number;     // hours
}

@Component({
  selector: 'app-gm-pick-slot-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="modal-header">
    <div class="d-flex align-items-center gap-3">
      <img [src]="gm.image || 'assets/gm-placeholder.png'" alt="" width="44" height="44" class="rounded-circle">
      <div>
        <h5 class="modal-title m-0">{{ gmName() }}</h5>
        <small>Proponowane terminy</small>
      </div>
    </div>
    <button type="button" class="btn-close" aria-label="Close" (click)="close.emit()"></button>
  </div>

  <div class="modal-body">
    @if(quickGroups().length){
      <div class="mb-3">
        @for(group of quickGroups(); track group.label){
          <div class="mb-2">
            <div class="fw-semibold mb-2">{{ group.label }}</div>
            <div class="d-flex flex-wrap gap-2">
              @for(slot of group.slots; track slot.date + '-' + slot.startHour){
                <button class="btn btn-outline"
                        (click)="onPick(slot)">
                  {{ labelForSlot(slot) }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <p class="text-muted">Brak propozycji w najbliższych dniach.</p>
    }

    <div class="d-flex align-items-center gap-2 mt-2">
      <span class="me-2">Więcej terminów:</span>
      <button class="btn btn-outline btn-sm" (click)="extend.next('+2d')">+2 dni</button>
      <button class="btn btn-outline btn-sm" (click)="extend.next('+3d')">+3 dni</button>
      <button class="btn btn-outline btn-sm" (click)="extend.next('+7d')">+7 dni</button>
      <button class="btn btn-outline btn-sm" (click)="extend.next('weekend')">Następny weekend</button>
    </div>

    @if(extended().length){
      <hr class="my-3">
      <div>
        <div class="fw-semibold mb-2">Najbliższe dostępne</div>
        <div class="d-flex flex-wrap gap-2">
          @for(slot of extended(); track slot.date + '-' + slot.startHour){
            <button class="btn btn-outline" (click)="onPick(slot)">
              {{ labelForSlot(slot) }}
            </button>
          }
        </div>
      </div>
    }
  </div>

  <div class="modal-footer">
    <button class="btn btn-outline" (click)="close.emit()">Zamknij</button>
  </div>
  `,
})
export class GmPickSlotModalComponent {
  private readonly reservationService = inject(ReservationService);

  // INPUTS (klasycznie, bez signals ze względu na NgbModal)
  @Input() gm!: IGmData;
  @Input() preferredDate!: string;     // 'YYYY-MM-DD'
  @Input() preferredStartHour!: number; // 17..22
  @Input() duration!: number;          // hours
  @Input() allowPrevDay = false;       // D-1 tylko jeśli ≥48h

  // OUTPUTS
  @Output() confirm = new EventEmitter<ISuggestedSlot>();
  @Output() close = new EventEmitter<void>();

  // rozszerzanie horyzontu
  readonly extend = new Subject<'+2d' | '+3d' | '+7d' | 'weekend'>();

  private readonly quickGroups$ = this.reservationService
    .suggestSlotsAround(this.preferredDate, this.preferredStartHour, this.duration, this.gm?.userId ?? null, this.allowPrevDay)
    .pipe(startWith([] as { label: string; slots: ISuggestedSlot[] }[]));

  private readonly extended$ = this.extend.pipe(
    switchMap(mode => this.gm?.userId
      ? this.reservationService.moreSlots(this.gm.userId, this.preferredDate, this.duration, mode)
      : of([] as ISuggestedSlot[])
    ),
    startWith([] as ISuggestedSlot[])
  );

  // mostek do templatki
  readonly quickGroups = toSignal(this.quickGroups$, { initialValue: [] as { label: string; slots: ISuggestedSlot[] }[] });
  readonly extended = toSignal(this.extended$, { initialValue: [] as ISuggestedSlot[] });

  gmName(): string {
    if (!this.gm) return '';
    return this.gm.useNickname ? this.gm.nickname : this.gm.firstName;
  }

  labelForSlot(s: ISuggestedSlot): string {
    // 'DD.MM • HH:00–HH:00'
    const d = new Date(s.date + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const from = String(s.startHour).padStart(2,'0') + ':00';
    const to = String(s.startHour + s.duration).padStart(2,'0') + ':00';
    return `${dd}.${mm} • ${from}–${to}`;
  }

  onPick(s: ISuggestedSlot) {
    this.confirm.emit(s);
  }
}
