import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TimeUtil {
  hhmm(hhmmOrS: string): string {
    const s = (hhmmOrS ?? '').slice(0, 5);
    const [H, M] = s.split(':');
    const h = String(H ?? '00').padStart(2, '0');
    const m = String(M ?? '00').padStart(2, '0');
    return `${h}:${m}`;
  }

  hhmmss(hhmmOrS: string): string {
    return `${this.hhmm(hhmmOrS)}:00`;
  }

  diffHours(hhmmA: string, hhmmB: string): number {
    const [aH, aM] = this.hhmm(hhmmA).split(':').map(Number);
    const [bH, bM] = this.hhmm(hhmmB).split(':').map(Number);
    const a = aH + aM / 60;
    const b = bH + bM / 60;
    return Math.max(0, b - a);
  }

  addHours(baseStart: string, hoursToAdd: number): string {
    const [h, m] = this.hhmm(baseStart).split(':').map(Number);
    const total = h * 60 + m + Math.round(hoursToAdd * 60);
    const H = Math.floor(total / 60);
    const M = total % 60;
    const hh = String(H).padStart(2, '0');
    const mm = String(M).padStart(2, '0');
    return `${hh}:${mm}:00`;
  }
}
