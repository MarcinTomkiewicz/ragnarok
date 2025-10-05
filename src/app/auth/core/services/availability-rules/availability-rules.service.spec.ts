import { TestBed } from '@angular/core/testing';

import { AvailabilityRulesService } from './availability-rules.service';

describe('AvailabilityRulesService', () => {
  let service: AvailabilityRulesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvailabilityRulesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
