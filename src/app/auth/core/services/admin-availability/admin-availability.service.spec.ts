import { TestBed } from '@angular/core/testing';

import { AdminAvailabilityService } from './admin-availability.service';

describe('AdminAvailabilityService', () => {
  let service: AdminAvailabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminAvailabilityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
