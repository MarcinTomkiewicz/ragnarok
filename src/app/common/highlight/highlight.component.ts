import { CommonModule } from '@angular/common';
import { Component, computed, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { sign } from 'crypto';

@Component({
  selector: 'app-highlight',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './highlight.component.html',
  styleUrls: ['./highlight.component.scss'],
})
export class HighlightComponent implements OnInit {
  heading = input<string>('');
  text = input<string>('');
  link = input<string>('');
  linkText = input<string>('');
  icon = input<string>('');

  iconClass = signal<string>('bi bi-star-fill');

  ngOnInit() {
    
    this.iconClass.set(this.icon() || 'bi bi-star-fill');
  }
}
