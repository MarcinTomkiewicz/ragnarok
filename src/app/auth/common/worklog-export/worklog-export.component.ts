import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AggRow,
  IWorkLog,
  JoinedEntry,
} from '../../../core/interfaces/i-work-log';
import { IUser } from '../../../core/interfaces/i-user';
import { CoworkerDirectoryService } from '../../core/services/coworker-directory/coworker-directory.service';
import { CoworkerRoles, RoleDisplay } from '../../../core/enums/roles';

@Component({
  selector: 'app-worklog-export',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex flex-wrap gap-2">
      @if (showEntriesButton() && hasEntries()) {
        <button
          type="button"
          class="btn btn-outline btn-sm"
          (click)="exportEntriesCsv()"
        >
          Eksportuj CSV – wpisy
        </button>
      }
      @if (showAggregatedButton() && hasAggregated()) {
        <button
          type="button"
          class="btn btn-primary btn-sm"
          (click)="exportAggregatedCsv()"
        >
          Eksportuj CSV – suma per osoba
        </button>
      }
    </div>
  `,
})
export class WorklogExportComponent {
  // Wejścia
  workLogs = input<ReadonlyArray<IWorkLog>>([]);
  totals = input<ReadonlyMap<string, number>>(new Map());
  usersMap = input<ReadonlyMap<string, IUser>>(new Map());
  showEntriesButton = input<boolean>(false);
  showAggregatedButton = input<boolean>(true);

  fileMonthLabel = input<string>(''); // np. "Wrzesień"
  fileYearLabel = input<string>('');  // np. "2025"

  private readonly dir = inject(CoworkerDirectoryService);

  // Reaktywne źródła
  private readonly workLogs$ = toObservable(this.workLogs);
  private readonly totals$ = toObservable(this.totals);
  private readonly users$ = toObservable(this.usersMap);
  private readonly official$ = this.dir.map$;

  // --- Filtry eksportu ---
  // Filtr roli: wycinamy wszystko powyżej Reception (czyli Coowner, Owner)
  private isAllowedRole(u: IUser | undefined): boolean {
    return u?.coworker !== CoworkerRoles.Coowner && u?.coworker !== CoworkerRoles.Owner;
  }

  // Główny filtr: user musi istnieć, nie może być testowy i musi przejść filtr roli
  private includeUser(u: IUser | undefined): boolean {
    if (!u) return false;
    if (u.isTestUser) return false;
    return this.isAllowedRole(u);
  }

  private roleLabel(u: IUser | undefined): string {
    return u?.coworker ? RoleDisplay[u.coworker] : '—';
  }

  // --- Wpisy połączone z nazwiskami + twardy filtr userów testowych/roli ---
  private readonly joinedEntries = toSignal(
    combineLatest([this.workLogs$, this.official$, this.users$]).pipe(
      map(([entries, official, users]) => {
        const src = (entries ?? []).filter(e => this.includeUser(users.get(e.userId)));
        return src.map<JoinedEntry>(e => {
          const o = official.get(e.userId);
          const u = users.get(e.userId);

          const firstName = (o?.firstName ?? u?.firstName ?? '').trim();
          const lastName  = (o?.lastName  ?? (u as any)?.lastName ?? '').trim();
          const displayName = (o?.displayName ?? u?.nickname ?? '').trim();
          const source: 'oficjalne' | 'fallback' = o ? 'oficjalne' : 'fallback';

          return {
            ...e,
            firstName: firstName || (u?.email ?? '[BRAK]'),
            lastName:  lastName  || (firstName ? '' : '[BRAK]'),
            displayName,
            source,
          };
        });
      })
    ),
    { initialValue: [] as JoinedEntry[] }
  );

  // --- Agregat (sumy) + twardy filtr userów testowych/roli ---
  private readonly aggregated = toSignal(
    combineLatest([this.totals$, this.official$, this.users$]).pipe(
      map(([totals, official, users]) => {
        const out: AggRow[] = [];
        const mapTotals = totals ?? new Map<string, number>();

        for (const [userId, hours] of mapTotals.entries()) {
          const u = (users ?? new Map<string, IUser>()).get(userId);
          if (!this.includeUser(u)) continue;

          const o = official.get(userId);
          const firstName = (o?.firstName ?? u?.firstName ?? '').trim();
          const lastName  = (o?.lastName  ?? (u as any)?.lastName ?? '').trim();
          const nickname  = (o?.displayName ?? u?.nickname ?? '').trim();
          const source: 'oficjalne' | 'fallback' = o ? 'oficjalne' : 'fallback';

          out.push({
            userId,
            firstName: firstName || (u?.email ?? '[BRAK]'),
            lastName:  lastName  || (firstName ? '' : '[BRAK]'),
            nickname,
            hours: Number(hours ?? 0),
            source,
          });
        }

        out.sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName) ||
            a.userId.localeCompare(b.userId)
        );

        return out;
      })
    ),
    { initialValue: [] as AggRow[] }
  );

  // Widoczność przycisków zależnie od danych
  hasEntries() { return this.joinedEntries().length > 0; }
  hasAggregated() { return this.aggregated().length > 0; }

  // --- Eksport CSV: wpisy ---
  exportEntriesCsv() {
    const rows = this.joinedEntries();
    const header = [
      'User ID',
      'Imię',
      'Nazwisko',
      'Pseudonim',
      'Funkcja',
      'Data',
      'Godziny',
      'Komentarz',
      'Źródło danych',
    ];
    const users = this.usersMap();
    const data = rows.map(r => {
      const u = users.get(r.userId);
      return [
        r.userId,
        r.firstName,
        r.lastName,
        r.displayName,
        this.roleLabel(u),
        r.workDate,
        this.numToAccounting(r.hours),
        (r.comment ?? '').replace(/\r?\n/g, ' '),
        r.source,
      ];
    });
    const fname = this.buildFilename('wpisy');
    this.downloadCsv([header, ...data], fname);
  }

  // --- Eksport CSV: agregat ---
  exportAggregatedCsv() {
    const rows = this.aggregated();
    const header = [
      'User ID',
      'Imię',
      'Nazwisko',
      'Pseudonim',
      'Funkcja',
      'Suma godzin',
      'Źródło danych',
    ];
    const users = this.usersMap();
    const data = rows.map(r => {
      const u = users.get(r.userId);
      return [
        r.userId,
        r.firstName,
        r.lastName,
        r.nickname,
        this.roleLabel(u),
        this.numToAccounting(r.hours),
        r.source,
      ];
    });
    const fname = this.buildFilename('suma');
    this.downloadCsv([header, ...data], fname);
  }

  // --- BOM/UTF-8 + nazewnictwo plików ---
  private buildFilename(kind: 'wpisy' | 'suma') {
    const m = (this.fileMonthLabel() || this.todayMonth()).replace(/\s+/g, '_');
    const y = this.fileYearLabel() || this.todayYear();
    return `Zestawienie_godzin_zleceniobiorców_Ragnarok_-_${m}_${y}_${kind}.csv`;
  }

  private downloadCsv(rows: (string | number)[][], filename: string) {
    const csv = rows.map(r => r.map(v => this.csvCell(String(v))).join(';')).join('\r\n');
    // BOM aby Excel poprawnie czytał polskie znaki
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  private numToAccounting(n: number) { return String(n).replace('.', ','); }

  private csvCell(s: string) {
    const needsQuotes = /[;\n"]/g.test(s);
    const esc = s.replace(/"/g, '""');
    return needsQuotes ? `"${esc}"` : esc;
  }

  private todayMonth() { return new Date().toLocaleString('pl-PL', { month: 'long' }); }
  private todayYear() { return String(new Date().getFullYear()); }
}
