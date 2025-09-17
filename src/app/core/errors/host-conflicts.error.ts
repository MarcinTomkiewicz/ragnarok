import { AppErrorCode } from '../enums/errors';
import { HostSignupScope } from '../enums/events';

// zamiast „gołych stringów” – enum na nazwę indeksu/konstraintu
export enum HostConflictConstraint {
  Session = 'uniq_hosts_session',
  Discussion = 'uniq_hosts_discussion',
}

export class HostSignupConflictError extends Error {
  readonly code = AppErrorCode.HostConflict;
  override readonly name = 'HostSignupConflictError';

  constructor(
    public readonly eventId: string,
    public readonly dateIso: string,
    public readonly roomName: string | null,
    public readonly role: HostSignupScope,
    public readonly constraint?: HostConflictConstraint,
    message?: string
  ) {
    super(
      message ??
        (roomName
          ? `Sala „${roomName}” jest już zajęta w dniu ${dateIso}.`
          : `Na termin ${dateIso} istnieje już zgłoszenie prowadzącego.`)
    );
  }

  static fromSupabase(
    err: any,
    ctx: { eventId: string; dateIso: string; roomName: string | null; role: HostSignupScope }
  ): HostSignupConflictError | null {
    const code = err?.code ?? err?.error?.code;
    if (String(code) !== '23505') return null;

    const details: string = err?.details ?? err?.message ?? '';
    const constraint =
      details.includes(HostConflictConstraint.Session)
        ? HostConflictConstraint.Session
        : details.includes(HostConflictConstraint.Discussion)
        ? HostConflictConstraint.Discussion
        : undefined;

    return new HostSignupConflictError(
      ctx.eventId,
      ctx.dateIso,
      ctx.roomName,
      ctx.role,
      constraint
    );
  }
}

export function isHostSignupConflict(e: unknown): e is HostSignupConflictError {
  return !!e && (e as any).code === AppErrorCode.HostConflict;
}
