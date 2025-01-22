import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common';
import { REGULATIONS } from '../../core/utils/regulations';

@Component({
  selector: 'app-regulations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './regulations.component.html',
  styleUrl: './regulations.component.scss'
})
export class RegulationsComponent {
  @Input() type!: 'pass' | 'rent';

  private readonly regulations = REGULATIONS;
  private readonly regulationNumber = this.type === 'pass' ? 1 : 0;
  public regulation = this.regulations[0];


  ngOnInit() {
    this.regulation = this.regulations[this.regulationNumber]
  }
}
