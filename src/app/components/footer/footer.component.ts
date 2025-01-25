import { Component, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';
import { RegulationsComponent } from '../regulations/regulations.component'

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private readonly modalService = inject(NgbModal);

  openPrivacyPolicy() {
    this.modalService.open(PrivacyPolicyComponent, { size: 'lg' });
  }

    openRules(type: 'loyalty' | 'voucher') {
      const modalRef = this.modalService.open(RegulationsComponent, { size: 'lg' });
      modalRef.componentInstance.type = type;
    }
}
