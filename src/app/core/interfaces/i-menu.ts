export interface IMenu {
  label: string;              // Tekst widoczny w menu
  path?: string;              // Ścieżka routingu (jeśli brak children)
  external?: boolean;         // Jeśli link wychodzi poza domenę
  disabled?: boolean;         // Wyłączenie linku (np. „wkrótce”)
  icon?: string;              // Nazwa ikony
  badge?: 'new' | 'soon' | string; // np. "Nowość"
  target?: '_blank' | '_self'; // Cel otwarcia linku
  children?: IMenu[];         // Podmenu – rekurencyjne
}
