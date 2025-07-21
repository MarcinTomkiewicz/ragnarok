import { CommonModule } from '@angular/common';
import { Component, input, ViewEncapsulation } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { IOfferDetails } from '../../core/interfaces/i-offer-details';

@Component({
  selector: 'app-services-table',
  standalone: true,
  imports: [CommonModule, NgbTooltip],
  templateUrl: './services-table.component.html',
  styleUrl: './services-table.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ServicesTableComponent {
  services = input<IOfferDetails[]>([])
  isServiceByHour = input<boolean>(true);
}
