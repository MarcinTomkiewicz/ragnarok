import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BackendService } from '../../core/services/backend/backend.service';
import { INews } from '../../core/interfaces/i-news';
import { ConverterService } from '../../core/services/converter/converter.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-news-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-details.component.html',
  styleUrl: './news-details.component.scss',
})
export class NewsDetailsComponent {
  private readonly backendService = inject(BackendService);
  private readonly route = inject(ActivatedRoute);
  private readonly converter = inject(ConverterService);

  private readonly id = this.route.snapshot.paramMap.get('id');

  readonly newsData = signal<INews | null>(null);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    if (this.id) {
      this.backendService.getById<INews>('news', this.id, 800, 400).subscribe({
        next: (news) => {
          if (news) {
            this.newsData.set({
              ...news,
              createdAt: this.converter.convert(
                news.created_at,
                'date',
                'dd-MM-yyyy HH:mm'
              ),
            });
          } else {
            this.errorMessage.set('Nie znaleziono newsa o podanym ID.');
          }
        },
        error: (err) => {
          console.error('Błąd przy pobieraniu newsa:', err);
          this.errorMessage.set(
            'Wystąpił błąd podczas pobierania danych newsa.'
          );
        },
        complete: () => console.log('Pobieranie newsa zakończone.'),
      });
    } else {
      this.errorMessage.set('Brak ID newsa w adresie URL.');
    }
  }

    private authorCache = new Map<string, Observable<any>>();
  
    getAuthor(authorId: string): Observable<any> {
      if (!this.authorCache.has(authorId)) {
        const obs$ = this.backendService.getById('users', authorId).pipe(
        );
        this.authorCache.set(authorId, obs$);
      }
      return this.authorCache.get(authorId)!;
    }
}
