import { TestBed } from '@angular/core/testing';

import { ReceptionScheduleService } from './reception-schedule.service';

describe('ReceptionScheduleService', () => {
  let service: ReceptionScheduleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReceptionScheduleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
