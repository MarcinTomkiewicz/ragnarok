import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';
import { PlatformService } from '../../core/services/platform/platform.service';
import { MapLoaderService } from '../../core/services/map-loader/map-loader.service';

type LatLngLiteral = { lat: number; lng: number };

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="gmap-container" #mapContainer></div>`,
})
export class MapComponent implements OnInit, OnDestroy {
  height = input<number>(300);
  center = input<LatLngLiteral>({ lat: 52.39680726850538, lng: 16.92647133497495 });
  zoom = input<number>(17);
  mapId = input<string>('Ragnarok');
  showMarker = input<boolean>(true);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly loader = inject(MapLoaderService);
  private readonly platform = inject(PlatformService);

  private observer?: IntersectionObserver;
  private map?: any;
  private marker?: any;

  ngOnInit(): void {
    if (!this.platform.isBrowser) return;

    const host = this.el.nativeElement.querySelector('.gmap-container') as HTMLElement;
    this.observer = new IntersectionObserver(async (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        this.observer?.disconnect();
        await this.initMap(host);
      }
    }, { rootMargin: '100px' });
    this.observer.observe(host);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.map = undefined as any;
    this.marker = undefined as any;
  }

  private async initMap(container: HTMLElement) {
    await this.loader.load(['marker']);

    const mapsLib: any = await (globalThis as any).google.maps.importLibrary('maps');
    const markerLib: any = await (globalThis as any).google.maps.importLibrary('marker');

    const MapCtor = mapsLib.Map;
    const AdvancedMarkerElement = markerLib.AdvancedMarkerElement;

    this.map = new MapCtor(container, {
      center: this.center(),
      zoom: this.zoom(),
      ...(this.mapId() ? { mapId: this.mapId() } : {}),
    });

    if (this.showMarker()) {
      const size = 66;
      const pad  = 8; 
      const ring = 2; 

      const imgSize = size - (pad * 2);

      const host = document.createElement('div');
      host.style.position = 'relative';
      host.style.width = `${size}px`;
      host.style.height = `${size}px`;
      host.style.pointerEvents = 'none';

      const tear = document.createElement('div');
      tear.style.position = 'absolute';
      tear.style.inset = '0';
      tear.style.background = '#16140f';
      tear.style.border = `${ring}px solid #16140f`;
      tear.style.borderRadius = '50% 50% 50% 0';
      tear.style.transform = 'rotate(-45deg)';
      tear.style.boxShadow = '0 2px 6px rgba(0,0,0,.35)';

      const imgWrap = document.createElement('div');
      imgWrap.style.position = 'absolute';
      imgWrap.style.left = `${pad}px`;
      imgWrap.style.top = `${pad}px`;
      imgWrap.style.width = `${imgSize}px`;
      imgWrap.style.borderRadius = '50%';

      const img = document.createElement('img');
      img.src = 'ragnarok.avif'; 
      img.alt = 'Ragnarok - Centrum Gier Fabularnych';
      img.style.width = '100%';

      imgWrap.appendChild(img);
      host.appendChild(tear);
      host.appendChild(imgWrap);

      this.marker = new AdvancedMarkerElement({
        map: this.map,
        position: this.center(),
        content: host,
      });
    }
  }
}
