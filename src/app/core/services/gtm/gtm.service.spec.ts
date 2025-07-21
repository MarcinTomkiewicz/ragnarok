import { TestBed } from '@angular/core/testing';

import { GtmService } from './gtm.service';

describe('GtmService', () => {
  let service: GtmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GtmService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
