import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { GmDirectoryService } from '../../../core/services/gm/gm-directory/gm-directory.service';

@Component({
  selector: 'app-gm-picker',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './gm-picker.component.html',
  styleUrl: './gm-picker.component.scss',
})
export class GmPickerComponent {
  private gmDirectoryService = inject(GmDirectoryService);

  gms = input.required<IGmData[]>();
  selectedId = input<string | null>(null);

  selectedChange = output<string | null>();

  private term = signal('');

  filteredGms = computed(() => {
    const src = this.gms();
    const t = this.term().trim().toLowerCase();
    return t.length >= 3
      ? src.filter((g) => this.gmName(g).toLowerCase().includes(t))
      : src;
  });

  selectedName = computed(() => {
    const id = this.selectedId();
    if (!id) return '';
    const gm = this.gms().find((g) => g.userId === id);
    return gm ? this.gmName(gm) : '';
  });

  onSearch(ev: Event) {
    this.term.set((ev.target as HTMLInputElement).value ?? '');
  }

  choose(id: string | null) {
    this.selectedChange.emit(id);
  }

  gmName(gm: IGmData) {
    return this.gmDirectoryService.gmDisplayName(gm);
  }
}
