import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { IContentTrigger } from '../../../core/interfaces/i-content-trigger';

@Component({
  selector: 'app-trigger-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-2">
      <input
        type="text"
        class="form-control"
        placeholder="Szukaj triggerów…"
        (input)="onSearch($event)"
        [disabled]="disabled()"
      />
    </div>

    <div class="d-flex flex-wrap gap-2">
      @for (t of baseSorted(); track t.slug) {
      <div
        class="style-checkbox"
        [class.disabled]="globalDisabledOrMax(t.slug)"
        [class.highlight]="matchesQuery(t)"
      >
        <input
          class="style-checkbox-input"
          type="checkbox"
          [checked]="isSelected(t.slug)"
          [disabled]="globalDisabledOrMax(t.slug)"
          (change)="toggle(t.slug)"
          id="trigger_{{ t.slug }}"
        />
        <label class="style-checkbox-label" [for]="'trigger_' + t.slug">
          {{ t.label }}
        </label>
      </div>
      }
    </div>
  `,
  styles: `
@import 'abstracts/variables';

.style-checkbox.highlight {
  background: rgba($primary-color, 0.12);
  border-color: $primary-color;
  box-shadow: 0 0 0 0.2rem rgba($primary-color, 0.15);

  .style-checkbox-label { color: $primary-color; }
}
.style-checkbox.disabled { opacity: .6; pointer-events: none; }
`,
})
export class TriggerPickerComponent {
  all = input.required<IContentTrigger[]>();
  selected = input<string[]>([]);
  selectedChange = output<string[]>();
  maxSelected = input<number>(Infinity);
  disabled = input<boolean>(false);

  private term = signal('');

  baseSorted = computed(() =>
    [...this.all()].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
  );

  onSearch(ev: Event) {
    if (this.disabled()) return;
    this.term.set((ev.target as HTMLInputElement).value ?? '');
  }

  isSelected(slug: string): boolean {
    return this.selected().includes(slug);
  }

  // globalne disabled lub limit max
  globalDisabledOrMax(slug: string): boolean {
    if (this.disabled()) return true;
    const sel = this.selected();
    return sel.length >= this.maxSelected() && !sel.includes(slug);
  }

  toggle(slug: string) {
    if (this.disabled()) return;
    const sel = this.selected();
    const i = sel.indexOf(slug);
    if (i >= 0) {
      this.selectedChange.emit(sel.filter((s) => s !== slug));
      return;
    }
    if (this.globalDisabledOrMax(slug)) return;
    this.selectedChange.emit([...sel, slug]);
  }

  matchesQuery(t: IContentTrigger): boolean {
    const q = this.term().trim().toLowerCase();
    if (q.length < 2) return false;
    const hay = [t.label, ...(t.aliases ?? [])].join(' ').toLowerCase();
    return hay.includes(q);
  }
}
