import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../core/services/toast/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [NgTemplateOutlet, NgbToastModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-container position-fixed top-0 end-0 p-3"
      style="z-index: 1200"
    >
      @for (toast of toastService.toasts(); track toast) {
        <ngb-toast
          [autohide]="true"
          [delay]="toast.delay ?? 4000"
          [class]="toast.classname"
          (hidden)="toastService.remove(toast)"
          [header]="toast.header || 'Informacja'"
        >
          <ng-container [ngTemplateOutlet]="toast.template" />
        </ngb-toast>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
