import { TestBed } from '@angular/core/testing';

import { ExternalEventsService } from './external-events.service';

describe('ExternalEventsService', () => {
  let service: ExternalEventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExternalEventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
