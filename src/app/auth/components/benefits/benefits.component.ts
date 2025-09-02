import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/services/auth/auth.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { hasStrictCoworkerRole } from '../../../core/utils/required-roles';

@Component({
  selector: 'app-benefits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './benefits.component.html',
  styleUrls: ['./benefits.component.scss'],
})
export class BenefitsComponent {
  private readonly auth = inject(AuthService);
  private readonly reservations = inject(ReservationService);

  readonly user = this.auth.user;

  readonly isGolden = computed(() => hasStrictCoworkerRole(this.user(), CoworkerRoles.Golden));
  readonly isMember = computed(() => hasStrictCoworkerRole(this.user(), CoworkerRoles.Member));
  readonly isMemberSection = computed(() => this.isMember() || this.isGolden());

  // Czy w tym tygodniu była już darmowa klubowa rezerwacja?
  private readonly usedFreeThisWeek$ = this.reservations.checkIfMemberHasReservationThisWeekInClubRooms();
  readonly usedFreeThisWeek = toSignal(this.usedFreeThisWeek$, { initialValue: false });

  // Pozostała darmowa sesja (0/1) – tylko dla member/golden
  readonly freeLeft = computed(() => (this.isMemberSection() ? (this.usedFreeThisWeek() ? 0 : 1) : 0));

  // Statyczne benefity (wartości z Twojego opisu)
  readonly chaoticThursdaysPrice = 30; // zł
  readonly gmOnDemandPricePerHour = 30; // zł/h
  readonly shopDiscountPercent = 10; // %

  // Reset tygodnia (pn–nd)
  readonly weekStartLabel = computed(() => this.formatDate(this.getMonday(new Date())));
  readonly weekEndLabel = computed(() => this.formatDate(this.getSunday(new Date())));

  // Helpers dat
  private getMonday(d: Date): Date {
    const x = new Date(d); x.setHours(0,0,0,0);
    const day = (x.getDay() + 6) % 7; // pon=0
    x.setDate(x.getDate() - day);
    return x;
  }
  private getSunday(d: Date): Date {
    const m = this.getMonday(d);
    const s = new Date(m); s.setDate(m.getDate() + 6); s.setHours(23,59,59,999);
    return s;
  }
  private formatDate(d: Date): string {
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  }
}
