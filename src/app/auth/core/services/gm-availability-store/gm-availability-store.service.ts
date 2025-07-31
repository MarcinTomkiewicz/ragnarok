import { computed, Injectable, signal } from '@angular/core';
import { IAvailabilitySlot } from '../../../../core/interfaces/i-gm-profile';

@Injectable({ providedIn: 'root' })
export class GmAvailabilityStoreService {
  private readonly data = signal<Map<string, IAvailabilitySlot>>(new Map());

  setDay(date: string, slot: IAvailabilitySlot) {
    const map = new Map(this.data());
    map.set(date, slot);
    this.data.set(map);
  }

  getDay(date: string): IAvailabilitySlot | undefined {
    return this.data().get(date);
  }

  setBulk(slots: IAvailabilitySlot[]) {
    const current = new Map(this.data());

    for (const slot of slots) {
      current.set(slot.date, slot);
    }
    this.data.set(current);
  }

  getAll(): IAvailabilitySlot[] {
    return Array.from(this.data().values());
  }

  removeDay(date: string) {
  const map = new Map(this.data());
  map.delete(date);
  this.data.set(map);
}

  clear() {
    this.data.set(new Map());
  }
}
