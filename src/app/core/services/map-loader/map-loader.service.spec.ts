import { TestBed } from '@angular/core/testing';

import { MapLoaderService } from './map-loader.service';

describe('MapLoaderService', () => {
  let service: MapLoaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapLoaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
