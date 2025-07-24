import { APP_INITIALIZER, Provider } from '@angular/core';
import { AuthService } from '../services/auth/auth.service';
import { firstValueFrom } from 'rxjs';

export function initializeAuthFactory(authService: AuthService): () => Promise<void> {
  return () => firstValueFrom(authService.loadUser()).then(() => void 0);
}


export const AppInitializerProvider: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initializeAuthFactory,
  deps: [AuthService],
  multi: true,
};
