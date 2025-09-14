import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  TemplateRef,
  computed,
  contentChild,
  viewChild,
  input,
  inject,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-card-carousel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="carousel" role="region" aria-roledescription="carousel" [attr.aria-label]="ariaLabel() || 'Karuzela'">
      <div #track
           class="track"
           [class.no-anim]="!transitionEnabled()"
           [style.transform]="'translateX(-' + offsetPx() + 'px)'"
           [style.paddingLeft.px]="sidePad()"
           [style.paddingRight.px]="sidePad()"
           (transitionend)="onTransitionEnd($event)">
        @for (it of slides(); let i = $index; track i) {
          <div class="slide"
               [style.flex]="'0 0 ' + effSlideW() + 'px'"
               [style.width.px]="effSlideW()"
               [style.marginRight.px]="i === slides().length - 1 ? 0 : gap()"
               role="group"
               [attr.aria-roledescription]="'slajd'"
               [attr.aria-label]="'Slajd ' + (i+1) + ' z ' + slides().length">
            <ng-container
              [ngTemplateOutlet]="itemTpl()!"
              [ngTemplateOutletContext]="{ $implicit: it }">
            </ng-container>
          </div>
        }
      </div>

      @if (items().length > 1) {
        @if (showPrev()) {
          <button type="button" class="nav prev"
                  (pointerdown)="$event.stopPropagation()"
                  (click)="prev()"
                  aria-label="Poprzednie">‹</button>
                }
                <!-- [style.left.px]="navOffset()" -->
        @if (showNext()) {
          <button type="button" class="nav next"
                  (pointerdown)="$event.stopPropagation()"
                  (click)="next()"
                  aria-label="Następne">›</button>
                }
                <!-- [style.right.px]="navOffset()" -->

        <div class="dots" role="tablist" aria-label="Wybierz slajd">
          @for (_ of items(); let i = $index; track i) {
            <button type="button" role="tab" class="dot"
                    (pointerdown)="$event.stopPropagation()"
                    [class.active]="i===logIndex()"
                    (click)="goLogical(i)"
                    [attr.aria-selected]="i===logIndex()"
                    [attr.aria-label]="'Slajd ' + (i+1)"></button>
          }
        </div>
      }
    </div>
  `,
})
export class CardCarouselComponent<T = unknown> {
  items = input.required<T[]>();
  ariaLabel = input<string | undefined>();
  slideWidth = input(357);
  gap = input(24);
  loop = input(false);

  readonly itemTpl = contentChild<TemplateRef<unknown>>(TemplateRef);
  readonly trackEl = viewChild<ElementRef<HTMLElement>>('track');
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly visIndex = signal(1);
  readonly transitionEnabled = signal(true);
  readonly pendingJump = signal<null | 'start' | 'end'>(null);
  readonly containerWidth = signal(0);

  // 1) Efektywna szerokość slajdu:
  //    - najmniejsze ekrany: max 310px
  //    - w pozostałych: wartość z inputu (np. 357)
  effSlideW = computed(() => {
    const cw = this.containerWidth();
    const desired = this.slideWidth();
    // “najmniejsze ekrany” — poniżej ~360px szerokości kontenera
    if (cw <= 360) return Math.min(310, desired);
    return desired;
  });

  slides = computed(() => {
    const arr = this.items() ?? [];
    if (!arr.length) return [];
    if (!this.loop()) return arr;
    return [arr[arr.length - 1], ...arr, arr[0]];
  });

  // 2) Centrowanie aktywnej karty — liczone z effSlideW()
  readonly sidePad = computed(() =>
    Math.max(0, Math.round((this.containerWidth() - this.effSlideW()) / 2))
  );

  // 3) Strzałki tuż przy krawędzi karty (min. 8px od brzegu)
  readonly navOffset = computed(() => Math.max(8, this.sidePad() - 18));

  logIndex = computed(() =>
    this.loop()
      ? Math.max(0, this.visIndex() - 1)
      : Math.max(0, Math.min(this.items().length - 1, this.visIndex()))
  );

  // 4) Przesunięcie toru — liczone z effSlideW()
  offsetPx = computed(() =>
    this.visIndex() * (this.effSlideW() + this.gap())
  );

  readonly showPrev = computed(() => (this.loop() ? true : this.visIndex() > 0));
  readonly showNext = computed(() =>
    this.loop() ? true : this.visIndex() < Math.max(0, this.slides().length - 1)
  );

  constructor() {
    this.host.nativeElement.tabIndex = 0;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) this.containerWidth.set(Math.round(rect.width));
    });
    ro.observe(this.host.nativeElement);
  }

  ngOnInit() { this.visIndex.set(this.loop() ? 1 : 0); }

  goLogical(i: number) {
    const len = this.items().length;
    if (!len) return;
    this.visIndex.set(this.loop() ? i + 1 : Math.max(0, Math.min(len - 1, i)));
  }

  next() {
    const len = this.items().length;
    if (!len) return;
    if (!this.loop()) {
      this.visIndex.set(Math.min(this.slides().length - 1, this.visIndex() + 1));
      return;
    }
    if (this.visIndex() === len) {
      this.visIndex.set(len + 1);
      this.pendingJump.set('start');
    } else {
      this.visIndex.set(this.visIndex() + 1);
    }
  }

  prev() {
    const len = this.items().length;
    if (!len) return;
    if (!this.loop()) {
      this.visIndex.set(Math.max(0, this.visIndex() - 1));
      return;
    }
    if (this.visIndex() === 1) {
      this.visIndex.set(0);
      this.pendingJump.set('end');
    } else {
      this.visIndex.set(this.visIndex() - 1);
    }
  }

  onTransitionEnd(ev: TransitionEvent) {
    if (ev.propertyName !== 'transform' || !this.loop()) return;

    const len = this.items().length;
    const jump = this.pendingJump();
    if (!jump) return;

    if (jump === 'start' && this.visIndex() !== len + 1) return;
    if (jump === 'end'   && this.visIndex() !== 0)       return;

    this.transitionEnabled.set(false);
    if (jump === 'start') this.visIndex.set(1);
    if (jump === 'end')   this.visIndex.set(len);
    this.pendingJump.set(null);

    this.trackEl()?.nativeElement.getBoundingClientRect();
    requestAnimationFrame(() => this.transitionEnabled.set(true));
  }

  private startX = 0;
  private dragging = false;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(ev: PointerEvent) {
    this.dragging = true;
    this.startX = ev.clientX;
  }
  @HostListener('pointerup', ['$event'])
  onPointerUp(ev: PointerEvent) {
    if (!this.dragging) return;
    const dx = ev.clientX - this.startX;
    if (Math.abs(dx) > 50) (dx < 0 ? this.next() : this.prev());
    this.dragging = false;
  }
  @HostListener('pointercancel') onPointerCancel() { this.dragging = false; }

  @HostListener('keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (ev.key === 'ArrowRight') { this.next(); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft')  { this.prev(); ev.preventDefault(); }
  }
}
