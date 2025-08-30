import { Component, computed, inject, OnInit } from '@angular/core';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { format } from 'date-fns';
import { GmService } from '../../../core/services/gm/gm.service';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { PartyService } from '../../../core/services/party/party.service';
import { IParty } from '../../../../core/interfaces/parties/i-party';

@Component({
  selector: 'app-reservation-summary',
  standalone: true,
  templateUrl: './reservation-summary.component.html',
  styleUrl: './reservation-summary.component.scss',
})
export class ReservationSummaryComponent implements OnInit {
  readonly store = inject(ReservationStoreService);
  private readonly gmService = inject(GmService);
  private readonly partyService = inject(PartyService);

  selectedGm!: IGmData;
  gmDisplayName: string = ''
  partyDisplayName = '';

  ngOnInit(): void {
    this.gmService.getGmById(this.store.selectedGm()).subscribe({
      next: gm => this.gmDisplayName = this.gmService.gmDisplayName(gm)
    });
    if (!this.store.selectedPartyId()) return;
    const partyId: string = this.store.selectedPartyId() ? this.store.selectedPartyId()! : '';
    this.partyService.getPartyById(partyId).subscribe({
      next: party => this.partyDisplayName = party ? party.name : ''
    })

  }

  readonly summary = computed(() => ({
    room: this.store.selectedRoom(),
    date: this.store.selectedDate(),
    startTime: this.store.selectedStartTime(),
    duration: this.store.selectedDuration(),
    needsGm: this.store.needsGm(),
    gmId: this.store.selectedGm(),
    systemId: this.store.selectedSystemId(),
    party: this.partyDisplayName,
  }));

  readonly formattedDate = computed(() => {
    const raw = this.store.selectedDate();
    return raw ? format(new Date(raw), 'dd.MM.yyyy') : '';
  });

  handleBack() {
    this.store.step.set(this.store.needsGm() ? 3 : 2);
  }
}
