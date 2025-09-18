export enum AppErrorCode {
  HostConflict = 'HOST_CONFLICT', // konflikt obsady prowadzącego (unikalne indeksy)
  DbUniqueViolation = '23505',    // surowy kod PG (fallback)
  AuthRequired = 'AUTH_REQUIRED',
  Forbidden = 'FORBIDDEN',
  Network = 'NETWORK',
  Unknown = 'UNKNOWN',
}

type AnyErr = {
  code?: string | number;
  status?: number;
  name?: string;
  message?: string;
} | unknown;

// Spłaszczamy różne kształty błędów do wspólnego kodu domenowego
export function normalizeErrorCode(err: AnyErr): AppErrorCode {
  const e = err as any;
  const rawCode = (e?.code ?? '') + '';

  // już zmapowany błąd domenowy
  if (rawCode === AppErrorCode.HostConflict) return AppErrorCode.HostConflict;

  // typowy przypadek z Supabase/PG: 23505 -> traktujemy jako HostConflict
  if (rawCode === AppErrorCode.DbUniqueViolation) return AppErrorCode.HostConflict;

  if (e?.status === 401) return AppErrorCode.AuthRequired;
  if (e?.status === 403) return AppErrorCode.Forbidden;

  // typowy fetch/network
  if (e?.name === 'TypeError' && /fetch/i.test(e?.message ?? '')) {
    return AppErrorCode.Network;
  }

  return AppErrorCode.Unknown;
}

// Ogólne komunikaty dla UI (bez szczegółów kontekstu)
export function messageForError(code: AppErrorCode): string {
  switch (code) {
    case AppErrorCode.HostConflict:
      return 'Ten termin jest już zajęty.';
    case AppErrorCode.AuthRequired:
      return 'Musisz być zalogowany, aby to zrobić.';
    case AppErrorCode.Forbidden:
      return 'Brak uprawnień do tej akcji.';
    case AppErrorCode.Network:
      return 'Problem z połączeniem sieciowym.';
    default:
      return 'Nie udało się wykonać operacji.';
  }
}
