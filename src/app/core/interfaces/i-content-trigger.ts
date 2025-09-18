export interface IContentTrigger {
  id: string;
  slug: string;
  label: string;
  category?: string | null;
  aliases?: string[] | null;
}