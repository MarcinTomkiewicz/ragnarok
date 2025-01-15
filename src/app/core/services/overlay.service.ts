import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'; // Importuj LoaderComponent
import { LoaderComponent } from '../../common/loader/loader.component';

@Injectable({
  providedIn: 'root',
})
export class OverlayService {
  private modalRef: any;
  private readonly modalService = inject(NgbModal)

  showLoader() {
    this.modalRef = this.modalService.open(LoaderComponent, {
      backdrop: 'static',
      keyboard: false,
      animation: false
    });
  }

  hideLoader() {
    if (this.modalRef) {
      this.modalRef.close();
    }
  }
}