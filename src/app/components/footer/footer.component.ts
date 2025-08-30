import { Component, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';
import { RegulationsComponent } from '../regulations/regulations.component'
import { RouterLink } from '@angular/router';
import { MenuService } from '../../core/services/menu/menu.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private readonly modalService = inject(NgbModal);
    readonly menu = inject(MenuService);

  openPrivacyPolicy() {
    this.modalService.open(PrivacyPolicyComponent, { size: 'lg' });
  }

    openRules(type: 'loyalty' | 'voucher') {
      const modalRef = this.modalService.open(RegulationsComponent, { size: 'lg' });
      modalRef.componentInstance.type = type;
    }
}
