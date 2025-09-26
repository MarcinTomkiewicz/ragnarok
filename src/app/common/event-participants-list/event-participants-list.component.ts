import {
  Component,
  input,
  signal,
  computed,
  inject,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap, of } from 'rxjs';

import { IUser } from '../../core/interfaces/i-user';
import {
  IEventParticipant,
  IEventParticipantVM,
} from '../../core/interfaces/i-event-participant';
import { EventParticipantsService } from '../../core/services/event-participant/event-participant.service';
import { BackendService } from '../../core/services/backend/backend.service';

import { hasMinimumCoworkerRole } from '../../core/utils/required-roles';
import { CoworkerRoles } from '../../core/enums/roles';
import { ToastService } from '../../core/services/toast/toast.service';

@Component({
  selector: 'app-participants-list',
  standalone: true,
  template: `
    @if (vm(); as v) {
    <div class="participants">
      <div class="summary">Uczestnicy ({{ v.items.length }})</div>

      @if (v.items.length === 0) {
      <div class="muted">Brak zapisów.</div>
      } @else {
      <ul class="list-group">
        @for (p of v.items; track p.id) {
        <li class="list-group list-group-item d-flex flex-row align-items-center justify-content-between gap-2">
          <span>{{ p.displayName }}</span>
          @if (p.isSelf || v.isAdmin) {
          <button
            class="btn btn-outline-danger btn-sm"
            [disabled]="isRemoving(p.id)"
            (click)="remove(p)"
            aria-label="Usuń uczestnika"
          >
            @if (isRemoving(p.id)) { Usuwanie… } @else { Usuń }
          </button>
          }
        </li>
        }
      </ul>
      }
    </div>
    }

    <ng-template #removeSuccessToast>
      <strong>Sukces!</strong> Uczestnik został usunięty z listy.
    </ng-template>

    <ng-template #removeErrorToast>
      <strong>Błąd!</strong> Nie udało się usunąć uczestnika.
    </ng-template>
  `,
})
export class ParticipantsListComponent {
  private readonly participantsService = inject(EventParticipantsService);
  private readonly backend = inject(BackendService);
  private readonly toastService = inject(ToastService);

  eventId = input.required<string>();
  dateIso = input.required<string>();
  scope = input<
    { hostId?: string | null; roomName?: string | null } | undefined
  >(undefined);
  currentUser = input<IUser | null>(null);
  refreshKey = input(0);

  readonly removeSuccessToast =
    viewChild<TemplateRef<unknown>>('removeSuccessToast');
  readonly removeErrorToast =
    viewChild<TemplateRef<unknown>>('removeErrorToast');

  private readonly refreshTick = signal(0);

  private readonly removingIds = signal<Set<string>>(new Set());
  isRemoving = (id: string) => this.removingIds().has(id);
  private markRemoving(id: string, on: boolean) {
    const next = new Set(this.removingIds());
    if (on) next.add(id);
    else next.delete(id);
    this.removingIds.set(next);
  }

  readonly isAdmin = computed(() =>
    hasMinimumCoworkerRole(this.currentUser(), CoworkerRoles.Reception)
  );

  private readonly items = toSignal(
    combineLatest([
      toObservable(this.eventId),
      toObservable(this.dateIso),
      toObservable(this.scope),
      toObservable(this.refreshKey),
      toObservable(this.refreshTick),
    ]).pipe(
      switchMap(([eventId, dateIso, scope]) =>
        this.participantsService.listForOccurrence(eventId, dateIso, scope)
      ),
      switchMap((rows: IEventParticipant[]) => {
        const ids = Array.from(
          new Set(rows.filter((r) => !!r.userId).map((r) => r.userId!))
        );
        if (ids.length === 0) {
          return of({ rows, usersById: new Map<string, IUser>() });
        }
        return this.backend.getByIds<IUser>('users', ids).pipe(
          map((users) => ({
            rows,
            usersById: new Map(users.map((u) => [u.id, u])),
          }))
        );
      }),
      map(({ rows, usersById }) =>
        rows.map<IEventParticipantVM>((r) => {
          if (!r.userId) {
            return {
              ...r,
              isGuest: true,
              isSelf: false,
              displayName: r.guestName || 'Gość',
            };
          }
          const u = usersById.get(r.userId) || null;
          const display = u
            ? u.useNickname && u.nickname?.trim()
              ? u.nickname!.trim()
              : u.firstName?.trim() || u.email || 'Użytkownik'
            : 'Użytkownik';
          return {
            ...r,
            isGuest: false,
            isSelf: !!this.currentUser() && r.userId === this.currentUser()!.id,
            displayName: display,
          };
        })
      )
    ),
    { initialValue: [] as IEventParticipantVM[] }
  );

  readonly vm = computed(() => ({
    items: this.items(),
    isAdmin: this.isAdmin(),
  }));

  remove(p: IEventParticipant) {
    if (!this.participantsService.canDelete(this.currentUser(), p)) return;

    this.markRemoving(p.id, true);

    this.participantsService.softDelete(p.id).subscribe({
      next: () => {
        this.refreshTick.set(this.refreshTick() + 1);
        this.markRemoving(p.id, false);
        const tpl = this.removeSuccessToast();
        if (tpl)
          this.toastService.show({
            template: tpl,
            classname: 'bg-success text-white',
            header: 'Usunięto uczestnika',
          });
      },
      error: () => {
        this.markRemoving(p.id, false);
        const tpl = this.removeErrorToast();
        if (tpl)
          this.toastService.show({
            template: tpl,
            classname: 'bg-danger text-white',
            header: 'Nie udało się usunąć',
          });
      },
    });
  }
}
