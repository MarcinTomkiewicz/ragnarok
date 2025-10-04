import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

import {
  IGmExtraInfo,
  defaultGmExtraInfo,
} from '../../../../core/interfaces/i-gm-extra-info';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';

@Component({
  selector: 'app-gm-extra-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbTooltip],
  templateUrl: './gm-extra-info.component.html',
  styleUrls: ['./gm-extra-info.component.scss'],
})
export class GmExtraInfoComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ReservationStoreService);

  // startujemy z tego, co (ew.) jest już w store, albo z domyślnych wartości
  private readonly initial: IGmExtraInfo =
    this.store.gmExtraInfo?.() ?? defaultGmExtraInfo;

  readonly form = this.fb.group({
    createCharactersAtTable: this.fb.control<boolean>(
      this.initial.createCharactersAtTable,
      { nonNullable: true }
    ),
    provideCharacterGuidelines: this.fb.control<boolean>(
      this.initial.provideCharacterGuidelines,
      { nonNullable: true }
    ),
    characterGuidelines: this.fb.control<string | null>(
      this.initial.characterGuidelines
    ),
    playersCount: this.fb.control<number | null>(this.initial.playersCount, {
      validators: [Validators.min(1), Validators.max(12)],
    }),
    extraNotes: this.fb.control<string | null>(this.initial.extraNotes),
  });

  // —— helpers do widoku ——
  get provideGuidelines(): boolean {
    return this.form.controls.provideCharacterGuidelines.value;
  }

  get playersCountTooHigh(): boolean {
    const n = this.form.controls.playersCount.value;
    return n != null && n > 5;
  }

  /** Ujednolicamy kształt danych (trimy, null’e itp.) */
  private normalized(): IGmExtraInfo {
    const raw = this.form.getRawValue();
    const trimOrNull = (s: string | null | undefined) =>
      typeof s === 'string' ? s.trim() || null : null;

    return {
      createCharactersAtTable: !!raw.createCharactersAtTable,
      provideCharacterGuidelines: !!raw.provideCharacterGuidelines,
      characterGuidelines: trimOrNull(raw.characterGuidelines),
      playersCount: raw.playersCount == null ? null : raw.playersCount,
      extraNotes: trimOrNull(raw.extraNotes),
    };
  }

  setCreateAtTable(val: boolean) {
    this.form.controls.createCharactersAtTable.setValue(val);
  }

  setProvideGuidelines(val: boolean) {
    this.form.controls.provideCharacterGuidelines.setValue(val);
    if (!val) this.form.controls.characterGuidelines.setValue(null);
  }

  /**
   * Zapis do store robimy na zmianę kroku — czyli kiedy komponent znika z DOM-u.
   * Działa zarówno przy „Dalej”, jak i „Wstecz”.
   */
  ngOnDestroy(): void {
    if (typeof this.store.gmExtraInfo?.set === 'function') {
      this.store.gmExtraInfo.set(this.normalized());
      this.store.saveToStorage?.();
    }
  }
}
