import { inject, Injectable } from '@angular/core';
import { BackendService } from '../backend/backend.service';
import { IRPGSystem } from '../../interfaces/i-rpg-system';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SystemService {
  private readonly backend = inject(BackendService);

  systems = signal<IRPGSystem[]>([]);

  loadAvailableSystems() {
    this.backend.getAll<IRPGSystem>('systems', 'name').subscribe((systems) => {
      this.systems.set(systems);
    });
  }
}
