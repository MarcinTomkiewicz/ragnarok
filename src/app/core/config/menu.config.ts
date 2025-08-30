import { IMenu } from '../interfaces/i-menu';

export const MENU_BASE: IMenu[] = [
  { label: 'O nas', path: '/about' },
  {
    label: 'Oferta',
    children: [
      { label: 'Wynajem Pomieszczeń', path: '/offers/rooms' },
      { label: 'Vouchery', path: '/offers/vouchers', badge: 'soon', disabled: true },
      { label: 'Kursy', path: '/offers/courses' },
      { label: 'Sklep', path: '/offers-list' },
    ],
  },
  { label: 'Klub Gier Fabularnych', path: '/memberships' },
  { label: 'Wydarzenia', path: '/events' },
  { label: 'Nasz Zespół', path: '/tech-stack' },
  { label: 'Kontakt', path: '/contact' },
];


export const FOOTER_LEGAL_PATHS: string[] = [
  '/legal/privacy',
  '/legal/loyalty',
  '/legal/voucher',
];

export const SOCIAL_LINKS = [
  { label: 'Facebook',  href: 'https://facebook.com/ragnarokrooms', icon: 'bi bi-facebook' },
  { label: 'Instagram', href: 'https://instagram.com/ragnarokrooms', icon: 'bi bi-instagram' },
  { label: 'TikTok',    href: 'https://tiktok.com/@ragnarokrooms',  icon: 'bi bi-tiktok' },
  { label: 'YouTube',   href: 'https://www.youtube.com/@CentrumRPG',icon: 'bi bi-youtube' },
  { label: 'Discord',   href: 'https://discord.gg/cJVxdmRvUY',      icon: 'bi bi-discord' },
];

export const GUEST_SIGNUP: IMenu = { label: 'Załóż konto', path: '/auth/register', badge: 'new' };
