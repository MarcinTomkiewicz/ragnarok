import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoaderService } from '../../core/services/loader/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
})
export class LoaderComponent implements OnInit, OnDestroy {
  isLoading = false;
  private subscription!: Subscription;
  private loaderService = inject(LoaderService);

  ngOnInit() {
    this.subscription = this.loaderService.loading$.subscribe({
      next: (state) => {
        this.isLoading = state
      },
    });    
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
