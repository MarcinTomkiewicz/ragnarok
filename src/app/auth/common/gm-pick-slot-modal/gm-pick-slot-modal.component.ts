import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { startWith, switchMap, tap } from 'rxjs/operators';
import { GmSlotsMode } from '../../../core/enums/gm-slots-mode';
import { IGmData } from '../../../core/interfaces/i-gm-profile';
import { GmSchedulingService } from '../../core/services/gm/gm-scheduling/gm-scheduling.service';

export interface ISuggestedSlot {
  date: string;
  startHour: number;
  duration: number;
}

@Component({
  selector: 'app-gm-pick-slot-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <div class="d-flex align-items-center gap-3">
        <img
          [src]="gm.image || 'assets/gm-placeholder.png'"
          alt=""
          width="44"
          height="44"
          class="rounded-circle"
        />
        <div>
          <h5 class="modal-title m-0">{{ gmName() }}</h5>
          <small>Proponowane terminy</small>
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        (click)="close.emit()"
      ></button>
    </div>

    <div class="modal-body">
      @if(quickGroups().length){
      <div class="mb-3">
        @for(group of quickGroups(); track group.label){
        <div class="mb-2">
          <div class="fw-semibold mb-2">{{ group.label }}</div>
          <div class="d-flex flex-wrap gap-2">
            @for(slot of group.slots; track slot.date + '-' + slot.startHour){
            <button class="btn btn-outline" (click)="onPick(slot)">
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

      <div class="d-flex align-items-center gap-2 mt-2 flex-wrap">
        <span class="me-2">Więcej terminów:</span>
        <button
          class="btn btn-outline btn-sm"
          (click)="extend.next(GmSlotsMode.next)"
        >
          Najbliższy wolny dzień
        </button>
        <button
          class="btn btn-outline btn-sm"
          (click)="extend.next(GmSlotsMode.twoDays)"
        >
          +2 dni
        </button>
        <button
          class="btn btn-outline btn-sm"
          (click)="extend.next(GmSlotsMode.threeDays)"
        >
          +3 dni
        </button>
        <button
          class="btn btn-outline btn-sm"
          (click)="extend.next(GmSlotsMode.sevenDays)"
        >
          +7 dni
        </button>
        <button
          class="btn btn-outline btn-sm"
          (click)="extend.next(GmSlotsMode.weekend)"
        >
          Następny weekend
        </button>
        @if(extended().length){
        <hr />
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
      @if(!extended().length && lastMode() !== null){
      <hr />
      <div class="alert alert-warning text-start mt-2" role="alert">
        {{
          lastMode() === GmSlotsMode.next
            ? 'Mistrz Gry jeszcze nie podał dostępności. Spróbuj proszę później.'
            : 'Mistrz Gry w tym terminie jest niedostępny.'
        }}
      </div>
      }
    </div>

    <div class="modal-footer">
      <button class="btn btn-outline" (click)="close.emit()">Zamknij</button>
    </div>
  `,
})
export class GmPickSlotModalComponent {
  private readonly gmSchedulingService = inject(GmSchedulingService);

  @Input() gm!: IGmData;
  @Input() preferredDate!: string;
  @Input() preferredStartHour!: number;
  @Input() duration!: number;
  @Input() allowPrevDay = false;

  @Output() confirm = new EventEmitter<ISuggestedSlot>();
  @Output() close = new EventEmitter<void>();

  readonly GmSlotsMode = GmSlotsMode;
  readonly extend = new Subject<GmSlotsMode>();

  readonly lastMode = signal<GmSlotsMode | null>(null);

  private readonly quickGroups$ = this.gmSchedulingService
    .suggestSlotsAround(
      this.preferredDate,
      this.preferredStartHour,
      this.duration,
      this.gm?.userId ?? null,
      this.allowPrevDay
    )
    .pipe(startWith([] as { label: string; slots: ISuggestedSlot[] }[]));

  private readonly extended$ = this.extend.pipe(
    tap((mode) => this.lastMode.set(mode)),
    switchMap((mode) =>
      this.gm?.userId
        ? this.gmSchedulingService.moreSlots(
            this.gm.userId,
            this.preferredDate,
            this.duration,
            mode,
            this.preferredStartHour
          )
        : of([] as ISuggestedSlot[])
    ),
    startWith([] as ISuggestedSlot[])
  );

  readonly quickGroups = toSignal(this.quickGroups$, {
    initialValue: [] as { label: string; slots: ISuggestedSlot[] }[],
  });
  readonly extended = toSignal(this.extended$, {
    initialValue: [] as ISuggestedSlot[],
  });

  gmName(): string {
    if (!this.gm) return '';
    return this.gm.useNickname ? this.gm.nickname : this.gm.firstName;
  }

  labelForSlot(s: ISuggestedSlot): string {
    const d = new Date(s.date + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const from = String(s.startHour).padStart(2, '0') + ':00';
    const to = String(s.startHour + s.duration).padStart(2, '0') + ':00';
    return `${dd}.${mm} • ${from}–${to}`;
  }

  onPick(s: ISuggestedSlot) {
    this.confirm.emit(s);
  }
}
