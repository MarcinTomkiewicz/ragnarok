import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { GmService } from '../../../core/services/gm/gm.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GmDetailsModalComponent } from '../../../../common/gm-details-modal/gm-details-modal.component';

@Component({
  selector: 'app-gm-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gm-selection.component.html',
  styleUrl: './gm-selection.component.scss',
})
export class GmSelectionComponent {
  readonly store = inject(ReservationStoreService);
  private readonly fb = inject(FormBuilder);
  private readonly reservationService = inject(ReservationService);
  private readonly gmService = inject(GmService);
  private readonly modal = inject(NgbModal);

  readonly systems = signal<IRPGSystem[]>([]);
  readonly gms = signal<IGmData[]>([]); // MG tylko dla wybranego systemu
  readonly allAvailableGms = signal<IGmData[]>([]); // Wszystkie dostępne MG dla wybranego terminu
  showAllGmsButton = signal(false); // Przycisk "Pokaż więcej"
  readonly showAll = signal(false); // Stan kontrolujący rozwiniętą listę

  readonly form: FormGroup = this.fb.group({
    systemId: [this.store.selectedSystemId()],
  });

  readonly canProceed = computed(() => {
    const gmId = this.store.selectedGm();
    const gm = this.gms().find((g) => g.userId === gmId);
    return !!gmId && !!this.form.value.systemId;
  });

  constructor() {
    // Inicjalizacja systemów
    this.reservationService.getAllSystems().subscribe((systems) => {
      this.systems.set(systems);
    });

    // Inicjalizacja formularza po wybraniu systemu
    const currentSystemId = this.store.selectedSystemId();
    if (currentSystemId) {
      this.form
        .get('systemId')
        ?.setValue(currentSystemId, { emitEvent: false });
      this.loadGms(currentSystemId);
    }

    // Resetowanie stanów przy zmianie systemu
    this.form
      .get('systemId')
      ?.valueChanges.subscribe((systemId: string | null) => {
        this.store.selectedSystemId.set(systemId);
        this.allAvailableGms.set([]); // Zerowanie dostępnych MG
        this.showAll.set(false); // Zerowanie rozwinięcia
        if (systemId) {
          this.loadGms(systemId); // Załaduj MG dla nowego systemu
        } else {
          this.gms.set([]); // Zerowanie listy MG, gdy nie ma systemu
          this.store.selectedGm.set(null); // Zerowanie wybranego MG
        }
      });
  }

  // Logika do pokazania tylko 4 pierwszych MG
  readonly visibleAllGms = computed(() =>
    this.showAll() ? this.allAvailableGms() : this.allAvailableGms().slice(0, 4)
  );

  readonly visibleGms = computed(() =>
    this.showAll() ? this.gms() : this.gms().slice(0, 4)
  );

  // Warunek, żeby przycisk "Pokaż więcej" był widoczny
  readonly shouldShowMoreButton = computed(() => {
    return !this.showAll() && this.gms().length > 4;
  });

  readonly shouldShowMoreGmsButton = computed(() => {
    return !this.showAll() && this.allAvailableGms().length > 4;
  });

  // Załaduj MG dla wybranego systemu
  private loadGms(systemId: string) {
    const date = this.store.selectedDate();
    const startTime = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();

    this.gms.set([]); // Zerowanie MG
    this.store.selectedGm.set(null); // Zerowanie wybranego MG
    this.showAllGmsButton.set(false); // Ukrywanie przycisku "Pokaż więcej"

    if (!date || !startTime || duration == null) {
      return;
    }

    const startHour = parseInt(startTime, 10);

    this.reservationService
      .getAvailableGmsForSystem(systemId, date, startHour, duration)
      .subscribe((gms) => {
        this.gms.set(gms); // Ustawianie załadowanych MG

        if (gms.length === 0) {
          this.showAllGmsButton.set(true); // Pokaż przycisk "Pokaż więcej", jeśli brak MG
        }
      });
  }

  // Załaduj wszystkie dostępne MG na dany termin
  showAllAvailableGms() {
    const date = this.store.selectedDate();
    const startTime = this.store.selectedStartTime();
    const duration = this.store.selectedDuration();

    if (!date || !startTime || duration == null) return;

    const startHour = parseInt(startTime, 10);

    this.reservationService
      .getAllGmsForTimeRange(date, startHour, duration)
      .subscribe((gms) => {
        this.allAvailableGms.set(gms);
      });
  }

  // Wybierz MG
  selectGm(gmId: string) {
    this.store.selectedGm.set(gmId);
  }

  // Wyświetlanie pełnej nazwy MG
  gmDisplayName(gm: IGmData): string {
    return this.gmService.gmDisplayName(gm);
  }

  // Obsługa kliknięcia na kartę MG
  onCardClick(gm: IGmData): void {
    const modalRef = this.modal.open(GmDetailsModalComponent, {
      size: 'lg',
      centered: true,
    });
    modalRef.componentInstance.gm = gm;
  }
}
