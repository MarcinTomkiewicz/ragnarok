import { TestBed } from '@angular/core/testing';

import { GmService } from './gm.service';

describe('GmService', () => {
  let service: GmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GmService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
