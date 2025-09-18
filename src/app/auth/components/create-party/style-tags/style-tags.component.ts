import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { GmStyleTag, GmStyleTagLabels } from '../../../../core/enums/gm-styles';

@Component({
  selector: 'style-tags',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex flex-wrap gap-2">
      @for (tag of allTags(); track tag) {
      <div class="style-checkbox" [class.disabled]="isDisabled(tag)">
        <input
          class="style-checkbox-input"
          type="checkbox"
          [checked]="selected().includes(tag)"
          [disabled]="isDisabled(tag)"
          (change)="toggle(tag)"
          id="style_{{ tag }}"
        />
        <label class="style-checkbox-label" [for]="'style_' + tag">
          {{ labels()[tag] }}
        </label>
      </div>
      }
    </div>
  `,
})
export class StyleTagsComponent {
  selected = input<GmStyleTag[]>([]);
  labels = input(GmStyleTagLabels);
  disabled = input<boolean>(false); // <-- NOWE

  selectedChange = output<GmStyleTag[]>();

  allTags = computed(() => Object.values(GmStyleTag) as GmStyleTag[]);

  isDisabled(tag: GmStyleTag) {
    if (this.disabled()) return true; // globalny disable
    const sel = this.selected();
    return sel.length >= 3 && !sel.includes(tag); // limit 3
  }

  toggle(tag: GmStyleTag) {
    if (this.disabled()) return; // honoruj disabled
    const sel = this.selected();
    const idx = sel.indexOf(tag);
    if (idx >= 0) {
      this.selectedChange.emit(sel.filter((t) => t !== tag));
      return;
    }
    if (sel.length >= 3) return;
    this.selectedChange.emit([...sel, tag]);
  }
}
