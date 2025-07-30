import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
  standalone: true,
})
export class LinkifyPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    if (!value) return '';

    const urlRegex = /((https?:\/\/|www\.)[^\s]+)/gi;
    const html = value.replace(urlRegex, (url: string) => {
      const href = url.startsWith('http') ? url : `https://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
