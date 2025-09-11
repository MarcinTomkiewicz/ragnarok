import { TestBed } from '@angular/core/testing';

import { AvailabilityStoreService } from './availability-store.service';

describe('AvailabilityStoreService', () => {
  let service: AvailabilityStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvailabilityStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
