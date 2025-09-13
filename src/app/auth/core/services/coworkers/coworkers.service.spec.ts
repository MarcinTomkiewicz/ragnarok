import { TestBed } from '@angular/core/testing';

import { CoworkersService } from './coworkers.service';

describe('CoworkersService', () => {
  let service: CoworkersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CoworkersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
