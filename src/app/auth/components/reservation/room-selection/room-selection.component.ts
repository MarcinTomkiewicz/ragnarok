import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as formatFn,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { Rooms } from '../../../../core/enums/rooms';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room-selection.component.html',
})
export class RoomSelectionComponent {
  private readonly reservationService = inject(ReservationService);

  readonly selectionConfirmed = output<{ room: Rooms; date: string }>();

  readonly selectedRoom = signal<Rooms>(Rooms.Midgard);
  readonly selectedDate = signal<string | null>(null);
  readonly rooms = Object.values(Rooms);
  readonly currentMonth = signal(new Date());

  readonly minMonth = startOfMonth(new Date());
  readonly maxMonth = startOfMonth(addMonths(new Date(), 1));

  readonly canGoPrev = computed(
    () => this.currentMonth().getTime() > this.maxMonth.getTime()    
  );
  readonly canGoNext = computed(
    () => this.currentMonth().getTime() < this.maxMonth.getTime()
  );

  readonly dayNames = Array.from({ length: 7 }, (_, i) =>
    formatFn(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'ccc', {
      locale: pl,
    })
  );

  readonly visibleDays = computed(() => {
    const start = startOfWeek(startOfMonth(this.currentMonth()), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(this.currentMonth()), {
      weekStartsOn: 1,
    });
    return eachDayOfInterval({ start, end });
  });

  readonly formattedCurrentMonth = computed(() =>
    this.format(this.currentMonth(), 'LLLL yyyy')
  );

  readonly reservationsMap = signal<Map<string, IReservation[]>>(new Map());

  constructor() {
    effect(() => {
      const room = this.selectedRoom();
      const dates = this.visibleDays().map((d) => formatFn(d, 'yyyy-MM-dd'));

      const updatedMap = new Map<string, IReservation[]>();

      dates.forEach((dateStr) => {
        this.reservationService
          .getReservationsForRoom(room, dateStr)
          .subscribe((res) => {
            updatedMap.set(dateStr, res);
            this.reservationsMap.set(new Map(updatedMap));
          });
      });
    });
    console.log(this.currentMonth().getTime(), this.minMonth.getTime());
  }

  isReserved(date: Date): boolean {
    const dateStr = formatFn(date, 'yyyy-MM-dd');
    const reservations = this.reservationsMap().get(dateStr);
    return !!reservations?.length;
  }

  selectDate(date: Date) {
    this.selectedDate.set(formatFn(date, 'yyyy-MM-dd'));
  }

  format(date: Date, pattern: string) {
    return formatFn(date, pattern, { locale: pl });
  }

  prevMonth() {
    const newDate = addMonths(this.currentMonth(), -1);
    if (startOfMonth(newDate) >= this.minMonth) {
      this.currentMonth.set(newDate);
    }
  }

  nextMonth() {
    const newDate = addMonths(this.currentMonth(), 1);
    if (startOfMonth(newDate) <= this.maxMonth) {
      this.currentMonth.set(newDate);
    }
  }

  isPastDay(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isSameMonth(date: Date, base: Date): boolean {
    return isSameMonth(date, base);
  }

  confirmSelection() {
    if (this.selectedRoom() && this.selectedDate()) {
      this.selectionConfirmed.emit({
        room: this.selectedRoom(),
        date: this.selectedDate()!,
      });
    }
  }
}
