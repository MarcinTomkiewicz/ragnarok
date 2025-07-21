import { Component, Input, OnInit, inject } from '@angular/core'
import { CommonModule } from '@angular/common';
import { REGULATIONS } from '../../core/utils/regulations';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-regulations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './regulations.component.html',
  styleUrl: './regulations.component.scss'
})
export class RegulationsComponent implements OnInit {
  @Input() type: 'pass' | 'rent' | 'loyalty' | 'voucher' | 'special' = 'pass';

  private readonly activeModal = inject(NgbActiveModal)

  private readonly regulations = REGULATIONS;
  private regulationNumber = 0;
  public regulation = this.regulations[this.regulationNumber];


  ngOnInit() {
    this.setRegulationNumber()
    this.regulation = this.regulations[this.regulationNumber]    
  }

  setRegulationNumber() {
    switch (this.type) {
      case 'rent':
        this.regulationNumber = 0
        break;
      case 'pass':
        this.regulationNumber = 1
        break;
        case 'voucher':
        this.regulationNumber = 2
        break;
        case 'loyalty':
        this.regulationNumber = 3
        break;
        case 'special':
        this.regulationNumber = 4
        break;
      default:
        this.regulationNumber = 1
        break;
    }
  }

  close() {
    this.activeModal.close();
  }
}
