import { PlatformService } from '../services/platform/platform.service';

export function scrollToElementWithOffset(
  id: string,
  offset = 60,
  platformService: PlatformService
): void {
  if (platformService && !platformService.isBrowser) return;

  const el = document.getElementById(id);
  if (!el) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
}
