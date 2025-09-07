import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';

@Component({
  selector: 'app-systems-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './systems-picker.component.html',
  styleUrl: './systems-picker.component.scss'
})
export class SystemsPickerComponent {
 systems = input.required<IRPGSystem[]>();
  allowedIds = input<Set<string> | null>(null);
  selectedIds = input<string[]>([]);
  gmSelected = input(false);

  selectedChange = output<string[]>();

  private term = signal('');

  base = computed(() => {
    const all = this.systems();
    const allowed = this.allowedIds();
    return allowed ? all.filter((s) => allowed.has(s.id)) : all;
  });

  filtered = computed(() => {
    const t = this.term().trim().toLowerCase();
    const base = this.base();
    return t.length >= 3 ? base.filter((s) => s.name.toLowerCase().includes(t)) : base;
  });

  onSearch(ev: Event) {
    this.term.set((ev.target as HTMLInputElement).value ?? '');
  }

  onSelect(ev: Event) {
    const target = ev.target as HTMLSelectElement;
    const values = Array.from(target.selectedOptions).map((o) => o.value);
    const next = [...this.selectedIds(), ...values.filter((v) => !this.selectedIds().includes(v))];
    this.emitLimited(next);
  }

  remove(id: string) {
    const next = this.selectedIds().filter((x) => x !== id);
    this.selectedChange.emit(next);
  }

  private emitLimited(ids: string[]) {
    this.selectedChange.emit(ids.slice(0, 5));
  }

  nameById(id: string): string {
    return this.systems().find((s) => s.id === id)?.name ?? id;
  }
}
