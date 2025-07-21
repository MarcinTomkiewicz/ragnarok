export interface ISpecial {
  id: number;
  title: string;
  slug: string;
  contentBlocks: SpecialBlock[];
  forBeginners: boolean;
  image?: string;
  hasRegulations?: boolean;
}

export type SpecialBlock =
  | { type: 'paragraph'; paragraphs: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'list'; items: SpecialBlock[]; ordered?: boolean };

