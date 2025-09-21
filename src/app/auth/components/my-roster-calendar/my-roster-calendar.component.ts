import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ReceptionScheduleService } from '../../core/services/reception-schedule/reception-schedule.service';
import { ExternalEventsService } from '../../core/services/external-events/external-events.service';
import { IReceptionSchedule } from '../../../core/interfaces/i-reception-schedule';
import { IDayFlags } from '../../../core/interfaces/i-availability-slot';
import { TimeSlots } from '../../../core/enums/hours';

@Component({
  selector: 'app-my-roster-calendar',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './my-roster-calendar.component.html',
  styleUrls: ['./my-roster-calendar.component.scss'],
})
export class MyRosterCalendarComponent {
  private readonly auth = inject(AuthService);
  private readonly scheduleService = inject(ReceptionScheduleService);
  private readonly eventsService = inject(ExternalEventsService);

  private readonly meId = computed(() => this.auth.user()?.id ?? '');

  readonly dailyDataMap = signal<Map<string, IReceptionSchedule[]>>(new Map());

  private readonly shortNameByEventId = signal<Map<string, string>>(new Map());

  onMonthChanged(dates: string[]) {
    const userId = this.meId();
    if (!userId || dates.length === 0) {
      this.dailyDataMap.set(new Map());
      this.shortNameByEventId.set(new Map());
      return;
    }

    this.scheduleService.getForDates(dates).subscribe({
      next: (all) => {
        const mine = all.filter(
          s => s.receptionistId === userId || s.externalRunnerId === userId
        );

        const byDate = new Map<string, IReceptionSchedule[]>();
        mine.forEach(s => {
          if (!byDate.has(s.workDate)) byDate.set(s.workDate, []);
          byDate.get(s.workDate)!.push(s);
        });
        this.dailyDataMap.set(byDate);

        const needIds = Array.from(
          new Set(mine.map(s => s.externalEventId).filter((x): x is string => !!x))
        );
        if (!needIds.length) {
          this.shortNameByEventId.set(new Map());
          return;
        }

        const weekdays = Array.from(new Set(dates.map(d => new Date(d).getDay())));
        this.eventsService.getActiveForWeekdays(weekdays).subscribe({
          next: defs => {
            const map = new Map<string, string>();
            defs.forEach(d => {
              if (d?.id && d?.shortName && needIds.includes(d.id)) {
                map.set(d.id, d.shortName);
              }
            });
            this.shortNameByEventId.set(map);
          },
          error: () => this.shortNameByEventId.set(new Map()),
        });
      },
      error: () => {
        this.dailyDataMap.set(new Map());
        this.shortNameByEventId.set(new Map());
      },
    });
  }

  
mapDailyToHourlyAvailability = () => (items: unknown[]) => {
  const userId = this.meId();
  const rows = items as IReceptionSchedule[];

  const hasReception = rows.some(r => r.receptionistId === userId);
  const hasExternal  = rows.some(r => r.externalRunnerId === userId && r.externalEventId);

  const totalBlocks = TimeSlots.end - TimeSlots.noonStart;

  if (hasReception || hasExternal) {
    return Array<boolean>(totalBlocks).fill(false);
  }

  
  const mostlyRed = Array<boolean>(totalBlocks).fill(true);
  mostlyRed[0] = false;
  return mostlyRed;
};

  mapDailyToDayFlags = () => (items: unknown[]): IDayFlags => {
    const userId = this.meId();
    const rows = items as IReceptionSchedule[];
    const hasReception = rows.some(r => r.receptionistId === userId);
    const myExternal = rows.find(r => r.externalRunnerId === userId && r.externalEventId);

    const out: IDayFlags = {};
    if (!hasReception && myExternal?.externalEventId) {
      out.externalOnly = true;
      const name = this.shortNameByEventId().get(myExternal.externalEventId) ?? null;
      if (name) out.externalEventName = name;
    }
    return out;
  };
}
