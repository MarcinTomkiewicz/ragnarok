import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { PlatformService } from '../../core/services/platform/platform.service';
import { MapLoaderService } from '../../core/services/map-loader/map-loader.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="gmap-container" #mapContainer></div>`,
})
export class MapComponent implements OnInit, OnDestroy {
  height = input<number>(300);
  center = input<google.maps.LatLngLiteral>({
    lat: 52.39693009077769,
    lng: 16.92630935511027,
  });
  zoom = input<number>(17);
  mapId = input<string>('Ragnarok');
  showMarker = input<boolean>(true);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly loader = inject(MapLoaderService);
  private readonly platform = inject(PlatformService);

  private observer?: IntersectionObserver;
  private map?: google.maps.Map;
  private marker?: any;

  ngOnInit(): void {
    if (!this.platform.isBrowser) return;

    const host = this.el.nativeElement.querySelector(
      '.gmap-container'
    ) as HTMLElement;
    this.observer = new IntersectionObserver(
      async (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.observer?.disconnect();
          await this.initMap(host);
        }
      },
      { rootMargin: '100px' }
    );
    this.observer.observe(host);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.map = undefined as any;
    this.marker = undefined as any;
  }

  private async initMap(container: HTMLElement) {
    await this.loader.load(['marker']);
    const { Map } = (await (globalThis as any).google.maps.importLibrary(
      'maps'
    )) as google.maps.MapsLibrary;
    const { AdvancedMarkerElement } = (await (
      globalThis as any
    ).google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

    this.map = new Map(container, {
      center: this.center(),
      zoom: this.zoom(),
      ...(this.mapId() ? { mapId: this.mapId() } : {}),
    });

    if (this.showMarker()) {
      const img = document.createElement('img');
      img.src = 'ragnarok.avif';
      img.style.backgroundColor = '#16140f';
      img.style.width = '50px';
      img.style.height = '50px';
      img.style.borderRadius = '100%';

      this.marker = new AdvancedMarkerElement({
        map: this.map,
        position: this.center(),
        content: img,
      });
    }
  }
}
