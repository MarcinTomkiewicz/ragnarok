import { Injectable, signal } from '@angular/core';
import { IAvailabilitySlot, WorkType } from '../../../../core/interfaces/i-availability-slot';

@Injectable({ providedIn: 'root' })
export class AvailabilityStoreService {
  private readonly data = signal<Map<string, IAvailabilitySlot>>(new Map());

  private key(date: string, workType: WorkType) {
    return `${date}::${workType}`;
  }

  setDay(slot: IAvailabilitySlot) {
    const k = this.key(slot.date, slot.workType);
    const next = new Map(this.data());
    next.set(k, slot);
    this.data.set(next);
  }

  getDay(date: string, workType: WorkType): IAvailabilitySlot | undefined {
    return this.data().get(this.key(date, workType));
  }

  setBulk(slots: IAvailabilitySlot[]) {
    const next = new Map(this.data());
    for (const s of slots) next.set(this.key(s.date, s.workType), s);
    this.data.set(next);
  }

  getAll(workType?: WorkType): IAvailabilitySlot[] {
    const vals = Array.from(this.data().values());
    return workType ? vals.filter(v => v.workType === workType) : vals;
  }

  removeDay(date: string, workType: WorkType) {
    const next = new Map(this.data());
    next.delete(this.key(date, workType));
    this.data.set(next);
  }

  clearByWorkType(workType: WorkType) {
    const next = new Map(this.data());
    for (const [k, v] of next) if (v.workType === workType) next.delete(k);
    this.data.set(next);
  }

  clear() {
    this.data.set(new Map());
  }
}
