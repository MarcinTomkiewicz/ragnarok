import { TestBed } from '@angular/core/testing';

import { GmAvailabilityStoreService } from './gm-availability-store.service';

describe('GmAvailabilityStoreService', () => {
  let service: GmAvailabilityStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GmAvailabilityStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
