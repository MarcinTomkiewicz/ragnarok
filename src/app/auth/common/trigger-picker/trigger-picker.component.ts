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
      />
    </div>

    <div class="d-flex flex-wrap gap-2">
      @for (t of baseSorted(); track t.slug) {
      <div
        class="style-checkbox"
        [class.disabled]="isDisabled(t.slug)"
        [class.highlight]="matchesQuery(t)"
      >
        <input
          class="style-checkbox-input"
          type="checkbox"
          [checked]="isSelected(t.slug)"
          [disabled]="isDisabled(t.slug)"
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

  .style-checkbox-label {
    color: $primary-color;
  }
}
`,
})
export class TriggerPickerComponent {
  all = input.required<IContentTrigger[]>();
  selected = input<string[]>([]);
  selectedChange = output<string[]>();
  maxSelected = input<number>(Infinity);

  private term = signal('');

  // zawsze alfabetycznie (PL)
  baseSorted = computed(() =>
    [...this.all()].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
  );

  onSearch(ev: Event) {
    this.term.set((ev.target as HTMLInputElement).value ?? '');
  }

  isSelected(slug: string): boolean {
    return this.selected().includes(slug);
  }

  isDisabled(slug: string): boolean {
    const sel = this.selected();
    return sel.length >= this.maxSelected() && !sel.includes(slug);
  }

  toggle(slug: string) {
    const sel = this.selected();
    const i = sel.indexOf(slug);
    if (i >= 0) {
      this.selectedChange.emit(sel.filter((s) => s !== slug));
      return;
    }
    if (this.isDisabled(slug)) return;
    this.selectedChange.emit([...sel, slug]);
  }

  // zamiast filtrowania: tylko sygnalizujemy dopasowanie (do podświetlenia całego chipa)
  matchesQuery(t: IContentTrigger): boolean {
    const q = this.term().trim().toLowerCase();
    if (q.length < 2) return false;
    const hay = [t.label, ...(t.aliases ?? [])].join(' ').toLowerCase();
    return hay.includes(q);
  }
}
