import { Component, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { WindowRef } from '../../core/services/window-ref';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  showMore = false;
  isLargeScreen = true;
  
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private windowRef: WindowRef,
    @Inject(PLATFORM_ID) private platformId: any
  ) {}

  ngOnInit(): void {
    this.checkHash();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isLargeScreen = window.innerWidth >= 481;    
  }

  private checkHash() {
    const window = this.windowRef.nativeWindow;
    if (window) {
      const hash = window.location.hash;
      if (hash) {
        const element = this.document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }
 
  toggleShowMore() {
    this.showMore = !this.showMore;
    console.log(this.isLargeScreen || !this.showMore, window.innerWidth, this.isLargeScreen, !this.showMore);
    
  }
}