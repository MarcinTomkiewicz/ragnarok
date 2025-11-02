import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoaderService } from '../../core/services/loader/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
})
export class LoaderComponent {
  /** Optional external control; when set, overrides service state. */
  active = input<boolean | null>(null);

  private readonly loaderService = inject(LoaderService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly svcLoading = signal(false);

  /** Final loading flag used by the template. */
  readonly isLoading = computed<boolean>(() => {
    const external = this.active();
    return external ?? this.svcLoading();
  });

  constructor() {
    this.loaderService.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => this.svcLoading.set(state));
  }
}
