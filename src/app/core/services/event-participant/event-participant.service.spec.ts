import { TestBed } from '@angular/core/testing';

import { EventParticipantService } from './event-participant.service';

describe('EventParticipantService', () => {
  let service: EventParticipantService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventParticipantService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
