import { TestBed } from '@angular/core/testing';

import { GmSchedulingService } from './gm-scheduling.service';

describe('GmSchedulingService', () => {
  let service: GmSchedulingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GmSchedulingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
