import { Injectable, computed, signal } from '@angular/core';
import { Rooms } from '../../../../core/enums/rooms';
import { PlatformService } from '../../../../core/services/platform/platform.service';

@Injectable({ providedIn: 'root' })
export class ReservationStoreService {
  readonly step = signal(1);
  readonly selectedRoom = signal<Rooms>(Rooms.Midgard);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedStartTime = signal<string | null>(null);
  readonly selectedDuration = signal<number | null>(null);
  readonly needsGm = signal(false);
  readonly selectedGm = signal<string | null>(null);
  readonly selectedSystemId = signal<string | null>(null);
  readonly confirmedParty = signal(false);
  readonly selectedPartyId = signal<string | null>(null);

  readonly isReceptionMode = signal(false);
  readonly externalName = signal<string | null>(null);
  readonly externalPhone = signal<string | null>(null);
  readonly externalIsClubMember = signal<boolean | null>(null);

  constructor(private platformService: PlatformService) {
    if (this.platformService.isBrowser) {
      const room = sessionStorage.getItem('selectedRoom');
      if (room) this.selectedRoom.set(room as Rooms);

      const date = sessionStorage.getItem('selectedDate');
      if (date) this.selectedDate.set(date);

      const startTime = sessionStorage.getItem('selectedStartTime');
      if (startTime) this.selectedStartTime.set(startTime);

      const duration = sessionStorage.getItem('selectedDuration');
      if (duration) this.selectedDuration.set(Number(duration));

      const gm = sessionStorage.getItem('selectedGm');
      if (gm) this.selectedGm.set(gm);

      const needsGm = sessionStorage.getItem('needsGm');
      if (needsGm) this.needsGm.set(JSON.parse(needsGm));

      const externalName = sessionStorage.getItem('externalName');
      if (externalName) this.externalName.set(externalName);

      const externalPhone = sessionStorage.getItem('externalPhone');
      if (externalPhone) this.externalPhone.set(externalPhone);

      const externalIsClubMember = sessionStorage.getItem(
        'externalIsClubMember'
      );
      if (externalIsClubMember)
        this.externalIsClubMember.set(JSON.parse(externalIsClubMember));

      const selectedPartyId = sessionStorage.getItem('selectedPartyId');
      if (selectedPartyId) this.selectedPartyId.set(selectedPartyId);
    }
  }

  // Zapis do sessionStorage w metodzie, po każdej zmianie sygnału
  readonly saveToStorage = () => {
    if (this.platformService.isBrowser) {
      sessionStorage.setItem('selectedRoom', this.selectedRoom() ?? '');
      sessionStorage.setItem('selectedDate', this.selectedDate() ?? '');
      sessionStorage.setItem(
        'selectedStartTime',
        this.selectedStartTime() ?? ''
      );
      sessionStorage.setItem(
        'selectedDuration',
        (this.selectedDuration() ?? 0).toString()
      );
      sessionStorage.setItem('selectedGm', this.selectedGm() ?? '');
      sessionStorage.setItem('needsGm', JSON.stringify(this.needsGm()));
      sessionStorage.setItem('externalName', this.externalName() ?? '');
      sessionStorage.setItem('externalPhone', this.externalPhone() ?? '');
      sessionStorage.setItem(
        'externalIsClubMember',
        JSON.stringify(this.externalIsClubMember())
      );
      sessionStorage.setItem('selectedPartyId', this.selectedPartyId() ?? '');
    }
  };

  readonly isExternalInfoValid = computed(() => {
    const phone = this.externalPhone();
    return this.externalName() !== null && phone !== null && phone.length === 9;
  });

  readonly isDateValid = computed(
    () => !!this.selectedRoom() && !!this.selectedDate()
  );

  readonly isTimeValid = computed(
    () =>
      this.isDateValid() &&
      !!this.selectedStartTime() &&
      !!this.selectedDuration()
  );

  readonly isGmValid = computed(
    () => !this.needsGm() || (!!this.selectedGm() && !!this.selectedSystemId())
  );

  readonly isReadyForSummary = computed(
    () => this.isTimeValid() && this.isGmValid()
  );
}
