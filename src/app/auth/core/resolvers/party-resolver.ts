import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve,
  RouterStateSnapshot,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { PartyService } from '../../core/services/party/party.service';
import { IParty } from '../../../core/interfaces/parties/i-party';

@Injectable({
  providedIn: 'root',
})
export class PartyResolver implements Resolve<IParty | null> {
  constructor(private partyService: PartyService) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<IParty | null> {
    const partySlug = route.paramMap.get('slug');
    if (partySlug) {
      return this.partyService.getPartyBySlug(partySlug);  // Pobieramy drużynę po slug
    }
    return of(null);  // Jeśli brak slug, zwracamy null
  }
}