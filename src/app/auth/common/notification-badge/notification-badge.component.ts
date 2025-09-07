import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, OnInit } from '@angular/core';
import { NotificationService } from '../../core/services/notifications/notifications.service';
import { NotificationBucket } from '../../../core/enums/notification-bucket';
import { toSignal } from '@angular/core/rxjs-interop';
import { th } from 'date-fns/locale';

@Component({
  selector: 'app-notification-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (count() > 0) {
    <span
      class="notification-badge inline-badge"
      [class.wider]="count() > 9 && count() <= 99"
      [class.widest]="count() > 99"
      [attr.aria-label]="aria()"
    >
      {{ label() }}
    </span>
    }
  `,
})
export class NotificationBadgeComponent implements OnInit {
  private notifications = inject(NotificationService);

  bucket = input.required<NotificationBucket>();

  private counts = toSignal(this.notifications.counts$, {
    initialValue: {} as Record<NotificationBucket, number>,
  });

  ngOnInit(): void {
    console.log('NotificationBadge for bucket', this.bucket(), this.count());
  }

  count = computed(() => this.counts()[this.bucket()] ?? 0);
  label = computed(() => (this.count() > 99 ? '99+' : String(this.count())));
  aria = computed(() => `Oczekujące: ${this.label()}`);
}
